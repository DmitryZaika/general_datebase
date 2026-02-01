# --- Configuration ---
AWS_ACCOUNT_ID := 123456789012
REGION := us-east-2
REPO_NAME := granite-manager-remix
EC2_USER := ec2-user
EC2_IP := your-ec2-ip-address

# Full Image URI
IMAGE_URI := $(AWS_ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/$(REPO_NAME):latest

.PHONY: local-test build-push deploy-prod login

# 1. Login to AWS ECR
login:
	aws ecr get-login-password --region $(REGION) | docker login --username AWS --password-stdin $(AWS_ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com

# 2. Local Testing (Builds locally and runs with Nginx)
local-test:
	docker compose up --build

# 3. Build & Push (The "Heavy Lifting" done on your PC)
build-push: login
	docker build -t $(REPO_NAME) .
	docker tag $(REPO_NAME):latest $(IMAGE_URI)
	docker push $(IMAGE_URI)

# 4. Deploy to EC2
# This copies the config files and tells EC2 to pull the new image
prune:
	ssh $(EC2_USER)@$(EC2_IP) "docker system prune -f"

# 2. UPDATED: Deployment now cleans up "dangling" images automatically
deploy-prod:
	scp docker-compose.yml docker-compose.prod.yml nginx.conf $(EC2_USER)@$(EC2_IP):~/
	ssh $(EC2_USER)@$(EC2_IP) "\
		aws ecr get-login-password --region $(REGION) | docker login --username AWS --password-stdin $(AWS_ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com && \
		docker compose -f docker-compose.yml -f docker-compose.prod.yml pull && \
		docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d && \
		docker image prune -f" # <--- Safely cleans up the OLD version's layers

# 5. Clean up local Docker junk
clean:
	docker system prune -f
