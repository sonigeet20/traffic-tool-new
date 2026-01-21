#!/bin/bash
set -e

# Configuration
INSTANCE_ID="i-0eaaeb73c51e59789"
AMI_NAME="traffic-tool-headful-$(date +%Y%m%d-%H%M%S)"
LAUNCH_TEMPLATE_NAME="traffic-tool-lt"
ASG_NAME="traffic-tool-asg"

echo "🎯 Traffic Tool Infrastructure Update"
echo "======================================"
echo "Instance: $INSTANCE_ID"
echo "AMI Name: $AMI_NAME"
echo ""

# Step 1: Create AMI from the configured instance
echo "📸 Creating AMI from instance $INSTANCE_ID..."
AMI_ID=$(aws ec2 create-image \
  --instance-id "$INSTANCE_ID" \
  --name "$AMI_NAME" \
  --description "Traffic Tool with headful browser (Xvfb + DISPLAY=:99)" \
  --no-reboot \
  --query 'ImageId' \
  --output text)

echo "✅ AMI creation initiated: $AMI_ID"
echo "⏳ Waiting for AMI to become available..."

# Wait for AMI to be available
aws ec2 wait image-available --image-ids "$AMI_ID"
echo "✅ AMI is now available!"

# Step 2: Create new version of launch template
echo ""
echo "📝 Creating new launch template version..."

# Get current launch template data
CURRENT_VERSION=$(aws ec2 describe-launch-template-versions \
  --launch-template-name "$LAUNCH_TEMPLATE_NAME" \
  --versions '$Latest' \
  --query 'LaunchTemplateVersions[0]' \
  --output json)

# Extract current settings
INSTANCE_TYPE=$(echo "$CURRENT_VERSION" | jq -r '.LaunchTemplateData.InstanceType')
KEY_NAME=$(echo "$CURRENT_VERSION" | jq -r '.LaunchTemplateData.KeyName')
SECURITY_GROUP_IDS=$(echo "$CURRENT_VERSION" | jq -r '.LaunchTemplateData.SecurityGroupIds | join(" ")')
IAM_INSTANCE_PROFILE=$(echo "$CURRENT_VERSION" | jq -r '.LaunchTemplateData.IamInstanceProfile.Arn // empty')

echo "  Instance Type: $INSTANCE_TYPE"
echo "  Key Name: $KEY_NAME"
echo "  AMI: $AMI_ID"

# Build launch template creation command
NEW_VERSION=$(aws ec2 create-launch-template-version \
  --launch-template-name "$LAUNCH_TEMPLATE_NAME" \
  --source-version '$Latest' \
  --launch-template-data "{\"ImageId\":\"$AMI_ID\"}" \
  --query 'LaunchTemplateVersion.VersionNumber' \
  --output text)
echo "✅ Created launch template version: $NEW_VERSION"

# Step 3: Set new version as default
echo ""
echo "🔄 Setting version $NEW_VERSION as default..."
aws ec2 modify-launch-template \
  --launch-template-name "$LAUNCH_TEMPLATE_NAME" \
  --default-version "$NEW_VERSION" > /dev/null

echo "✅ Launch template updated!"

# Step 4: Update Auto Scaling Group
echo ""
echo "🔄 Updating Auto Scaling Group..."
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name "$ASG_NAME" \
  --launch-template "LaunchTemplateName=$LAUNCH_TEMPLATE_NAME,Version=\$Latest"

echo "✅ Auto Scaling Group updated!"

# Step 5: Start instance refresh
echo ""
echo "🔄 Starting instance refresh..."
REFRESH_ID=$(aws autoscaling start-instance-refresh \
  --auto-scaling-group-name "$ASG_NAME" \
  --preferences '{"MinHealthyPercentage":50,"InstanceWarmup":300}' \
  --query 'InstanceRefreshId' \
  --output text)

echo "✅ Instance refresh started: $REFRESH_ID"
echo ""
echo "======================================"
echo "✅ Infrastructure update complete!"
echo ""
echo "📊 Summary:"
echo "  - AMI: $AMI_ID"
echo "  - Launch Template: $LAUNCH_TEMPLATE_NAME (v$NEW_VERSION)"
echo "  - ASG: $ASG_NAME"
echo "  - Instance Refresh: $REFRESH_ID"
echo ""
echo "🔍 Monitor refresh progress:"
echo "  aws autoscaling describe-instance-refreshes --auto-scaling-group-name $ASG_NAME --instance-refresh-ids $REFRESH_ID"
echo ""
echo "⚠️  New instances will be gradually launched. This may take 5-10 minutes."
