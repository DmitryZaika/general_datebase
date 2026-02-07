# --- Configuration ---
AWS_ACCOUNT_ID := 741448943665
REGION := us-east-2
REPO_NAME := granite-manager-remix
EC2_USER := ec2-user
EC2_IP := ec2-16-58-227-251.us-east-2.compute.amazonaws.com
DOMAIN := granite-manager.com

# Full Image URI
IMAGE_URI := $(AWS_ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/$(REPO_NAME):latest

.PHONY: local-test build-push deploy-prod login push-env setup-host local-setup

################
# Local Commands
################
local-setup:
		@echo "Setting up local SSL directories..."
		sudo mkdir -p /var/www/certbot
		sudo mkdir -p /etc/letsencrypt
		sudo curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf -o /etc/letsencrypt/options-ssl-nginx.conf
		# On Mac, we need to ensure the current user has access to these sudo-created folders
		sudo chown -R $(shell id -un):$(shell id -gn) /var/www/certbot /etc/letsencrypt


local-certs: local-setup
	@echo "Generating dummy self-signed certs for $(DOMAIN)..."
	# Create the specific 'live' directory structure Nginx expects
	sudo mkdir -p /etc/letsencrypt/live/$(DOMAIN)

	# Generate the certs directly into that nested folder
	sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout /etc/letsencrypt/live/$(DOMAIN)/privkey.pem \
		-out /etc/letsencrypt/live/$(DOMAIN)/fullchain.pem \
		-subj "/C=US/ST=State/L=City/O=Organization/CN=$(DOMAIN)"

	# Create the DH params in the root of letsencrypt as per standard configs
	sudo openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048

	# Fix permissions again to ensure Docker can read the new subfolders
	sudo chown -R $(shell id -un):$(shell id -gn) /etc/letsencrypt

# Local Testing (Builds locally and runs with Nginx)
local-test:
	docker compose up --build

clean:
	docker system prune -f


################
# Prod Commands
################
login:
	aws ecr get-login-password --region $(REGION) | docker login --username AWS --password-stdin $(AWS_ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com

# New target to prepare the EC2 filesystem and install Docker
setup-host:
	ssh $(EC2_USER)@$(EC2_IP) "\
		sudo dnf update -y && \
		sudo dnf install -y docker && \
		sudo systemctl enable --now docker && \
		sudo usermod -aG docker $(EC2_USER) && \
		sudo mkdir -p /usr/local/lib/docker/cli-plugins && \
		sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose && \
		sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose && \
		sudo ln -sf /usr/local/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose && \
		sudo mkdir -p /var/www/certbot /etc/letsencrypt && \
		sudo curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf -o /etc/letsencrypt/options-ssl-nginx.conf && \
		sudo chown -R $(EC2_USER):$(EC2_USER) /var/www/certbot /etc/letsencrypt"


# Build & Push (The "Heavy Lifting" done on your PC)
build-push: login
	docker build -t $(REPO_NAME) .
	docker tag $(REPO_NAME):latest $(IMAGE_URI)
	docker push $(IMAGE_URI)


check-aws:
	ssh $(EC2_USER)@$(EC2_IP) "aws sts get-caller-identity || echo 'AWS CLI not configured!'"


deploy-prod:
	scp -r docker-compose.yml docker-compose.prod.yml nginx .env $(EC2_USER)@$(EC2_IP):~/
	ssh $(EC2_USER)@$(EC2_IP) "aws ecr get-login-password --region $(REGION) | docker login --username AWS --password-stdin $(AWS_ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com && \
		docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull && \
		docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d && \
		docker image prune -f"


prune:
	ssh $(EC2_USER)@$(EC2_IP) "docker system prune -f"
