# --- Configuration ---
AWS_ACCOUNT_ID := 741448943665
REGION := us-east-2
REPO_NAME := granite-manager-remix
EC2_USER := ec2-user
EC2_IP := ec2-3-147-83-220.us-east-2.compute.amazonaws.com
SSH_KEY = ~/colin.pem

# Full Image URI
IMAGE_URI := $(AWS_ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/$(REPO_NAME):latest

.PHONY: local-test build-push deploy-prod login push-env setup-host local-setup logs

################
# Dev Commands
################
local-test:
	docker compose up --build

clean:
	docker system prune -f


################
# Prod Commands
################
login:
	aws ecr get-login-password --region $(REGION) | docker login --username AWS --password-stdin $(AWS_ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com

check-aws:
	ssh -i $(SSH_KEY) $(EC2_USER)@$(EC2_IP) "aws sts get-caller-identity || echo 'AWS CLI not configured!'"

setup-host:
	ssh -i $(SSH_KEY) $(EC2_USER)@$(EC2_IP) "\
		sudo dnf update -y && \
		sudo dnf install -y docker openssl && \
		sudo systemctl enable --now docker && \
		sudo usermod -aG docker $(EC2_USER) && \
		sudo mkdir -p /usr/local/lib/docker/cli-plugins && \
		sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64 -o /usr/local/lib/docker/cli-plugins/docker-compose && \
		sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose && \
		sudo ln -sf /usr/local/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose"

build-push: login
	docker build -t $(REPO_NAME) .
	docker tag $(REPO_NAME):latest $(IMAGE_URI)
	docker push $(IMAGE_URI)

deploy-prod:
	scp -i $(SSH_KEY) -r docker-compose.yml docker-compose.prod.yml caddy .env $(EC2_USER)@$(EC2_IP):~/
	ssh -i $(SSH_KEY) $(EC2_USER)@$(EC2_IP) "aws ecr get-login-password --region $(REGION) | docker login --username AWS --password-stdin $(AWS_ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com && \
		docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull && \
		docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans && \
		docker image prune -f"

restart:
	ssh -i $(SSH_KEY) $(EC2_USER)@$(EC2_IP) "cd ~ && docker-compose -f docker-compose.yml -f docker-compose.prod.yml down && docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d"

logs:
	ssh -i $(SSH_KEY) $(EC2_USER)@$(EC2_IP) "docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f --tail=100"

prune:
	ssh $(EC2_USER)@$(EC2_IP) "docker system prune -f"
