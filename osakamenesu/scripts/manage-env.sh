#!/bin/bash

# Environment Variables Management Script
# This script helps manage environment variables across different environments

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to print colored output
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Function to show usage
usage() {
    cat << EOF
Usage: $0 [command] [environment]

Commands:
  setup    - Setup environment variables for specified environment
  check    - Check if all required environment variables are set
  export   - Export environment variables for deployment
  sync     - Sync environment variables from example files

Environments:
  local      - Local development
  staging    - Staging environment
  production - Production environment

Examples:
  $0 setup staging
  $0 check production
  $0 export staging
  $0 sync local
EOF
}

# Function to setup environment variables
setup_env() {
    local env=$1
    local web_env_file="$ROOT_DIR/services/web/.env.$env"
    local api_env_file="$ROOT_DIR/services/api/.env.$env"
    local web_example="$ROOT_DIR/services/web/.env.$env.example"
    local api_example="$ROOT_DIR/services/api/.env.$env.example"

    print_info "Setting up environment variables for $env..."

    # Web environment
    if [ -f "$web_example" ]; then
        if [ ! -f "$web_env_file" ]; then
            cp "$web_example" "$web_env_file"
            print_success "Created $web_env_file from example"
            print_warning "Please update the values in $web_env_file"
        else
            print_info "$web_env_file already exists"
        fi
    else
        print_error "Example file $web_example not found"
    fi

    # API environment
    if [ -f "$api_example" ]; then
        if [ ! -f "$api_env_file" ]; then
            cp "$api_example" "$api_env_file"
            print_success "Created $api_env_file from example"
            print_warning "Please update the values in $api_env_file"
        else
            print_info "$api_env_file already exists"
        fi
    else
        print_error "Example file $api_example not found"
    fi
}

# Function to check environment variables
check_env() {
    local env=$1
    local web_env_file="$ROOT_DIR/services/web/.env.$env"
    local api_env_file="$ROOT_DIR/services/api/.env.$env"
    local missing_vars=0

    print_info "Checking environment variables for $env..."

    # Check Web environment variables
    if [ -f "$web_env_file" ]; then
        print_info "Checking web environment variables..."
        while IFS= read -r line; do
            if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ ^[A-Z_]+= ]]; then
                var_name=$(echo "$line" | cut -d'=' -f1)
                var_value=$(echo "$line" | cut -d'=' -f2-)
                if [[ "$var_value" =~ your-|example|placeholder|changeme ]]; then
                    print_warning "Web: $var_name needs to be updated"
                    ((missing_vars++))
                fi
            fi
        done < "$web_env_file"
    else
        print_error "Web environment file not found: $web_env_file"
        ((missing_vars++))
    fi

    # Check API environment variables
    if [ -f "$api_env_file" ]; then
        print_info "Checking API environment variables..."
        while IFS= read -r line; do
            if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ ^[A-Z_]+= ]]; then
                var_name=$(echo "$line" | cut -d'=' -f1)
                var_value=$(echo "$line" | cut -d'=' -f2-)
                if [[ "$var_value" =~ your-|example|placeholder|changeme ]]; then
                    print_warning "API: $var_name needs to be updated"
                    ((missing_vars++))
                fi
            fi
        done < "$api_env_file"
    else
        print_error "API environment file not found: $api_env_file"
        ((missing_vars++))
    fi

    if [ $missing_vars -eq 0 ]; then
        print_success "All environment variables are properly set!"
    else
        print_error "Found $missing_vars issues with environment variables"
        return 1
    fi
}

# Function to export environment variables for deployment
export_env() {
    local env=$1
    local output_dir="$ROOT_DIR/deployment-env"

    mkdir -p "$output_dir"

    print_info "Exporting environment variables for $env deployment..."

    # Export Vercel environment variables
    if [ "$env" == "staging" ] || [ "$env" == "production" ]; then
        local web_env_file="$ROOT_DIR/services/web/.env.$env"
        local vercel_env_file="$output_dir/vercel-env-$env.txt"

        if [ -f "$web_env_file" ]; then
            echo "# Vercel environment variables for $env" > "$vercel_env_file"
            echo "# Run: vercel env add < $vercel_env_file" >> "$vercel_env_file"
            echo "" >> "$vercel_env_file"

            while IFS= read -r line; do
                if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ ^[A-Z_]+= ]]; then
                    echo "$line" >> "$vercel_env_file"
                fi
            done < "$web_env_file"

            print_success "Exported Vercel environment variables to $vercel_env_file"
        fi
    fi

    # Export Fly.io secrets
    if [ "$env" == "staging" ] || [ "$env" == "production" ]; then
        local api_env_file="$ROOT_DIR/services/api/.env.$env"
        local fly_secrets_file="$output_dir/fly-secrets-$env.sh"

        if [ -f "$api_env_file" ]; then
            echo "#!/bin/bash" > "$fly_secrets_file"
            echo "# Fly.io secrets for $env" >> "$fly_secrets_file"
            echo "# Run: bash $fly_secrets_file" >> "$fly_secrets_file"
            echo "" >> "$fly_secrets_file"
            echo "fly secrets set \\" >> "$fly_secrets_file"

            while IFS= read -r line; do
                if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ ^[A-Z_]+= ]]; then
                    var_name=$(echo "$line" | cut -d'=' -f1)
                    var_value=$(echo "$line" | cut -d'=' -f2-)
                    echo "  $var_name=\"$var_value\" \\" >> "$fly_secrets_file"
                fi
            done < "$api_env_file"

            app_name="osakamenesu-api"
            if [ "$env" == "staging" ]; then
                app_name="osakamenesu-api-stg"
            fi
            echo "  --app $app_name" >> "$fly_secrets_file"

            chmod +x "$fly_secrets_file"
            print_success "Exported Fly.io secrets to $fly_secrets_file"
        fi
    fi
}

# Function to sync environment variables from examples
sync_env() {
    local env=$1
    local web_env_file="$ROOT_DIR/services/web/.env.$env"
    local api_env_file="$ROOT_DIR/services/api/.env.$env"
    local web_example="$ROOT_DIR/services/web/.env.$env.example"
    local api_example="$ROOT_DIR/services/api/.env.$env.example"

    print_info "Syncing environment variables for $env..."

    # Function to merge env files
    merge_env_files() {
        local example_file=$1
        local env_file=$2
        local temp_file="${env_file}.tmp"

        # Create associative array from existing env file
        declare -A existing_vars
        if [ -f "$env_file" ]; then
            while IFS= read -r line; do
                if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ ^[A-Z_]+= ]]; then
                    var_name=$(echo "$line" | cut -d'=' -f1)
                    var_value=$(echo "$line" | cut -d'=' -f2-)
                    existing_vars["$var_name"]="$var_value"
                fi
            done < "$env_file"
        fi

        # Create new file with example structure but existing values
        > "$temp_file"
        while IFS= read -r line; do
            if [[ "$line" =~ ^# ]] || [[ -z "$line" ]]; then
                echo "$line" >> "$temp_file"
            elif [[ "$line" =~ ^[A-Z_]+= ]]; then
                var_name=$(echo "$line" | cut -d'=' -f1)
                if [[ -n "${existing_vars[$var_name]}" ]]; then
                    echo "$var_name=${existing_vars[$var_name]}" >> "$temp_file"
                else
                    echo "$line" >> "$temp_file"
                    print_warning "New variable added: $var_name"
                fi
            fi
        done < "$example_file"

        mv "$temp_file" "$env_file"
    }

    # Sync Web environment
    if [ -f "$web_example" ]; then
        if [ -f "$web_env_file" ]; then
            merge_env_files "$web_example" "$web_env_file"
            print_success "Synced web environment variables"
        else
            setup_env "$env"
        fi
    fi

    # Sync API environment
    if [ -f "$api_example" ]; then
        if [ -f "$api_env_file" ]; then
            merge_env_files "$api_example" "$api_env_file"
            print_success "Synced API environment variables"
        else
            setup_env "$env"
        fi
    fi
}

# Main script logic
case "$1" in
    setup)
        if [ -z "$2" ]; then
            print_error "Please specify an environment"
            usage
            exit 1
        fi
        setup_env "$2"
        ;;
    check)
        if [ -z "$2" ]; then
            print_error "Please specify an environment"
            usage
            exit 1
        fi
        check_env "$2"
        ;;
    export)
        if [ -z "$2" ]; then
            print_error "Please specify an environment"
            usage
            exit 1
        fi
        export_env "$2"
        ;;
    sync)
        if [ -z "$2" ]; then
            print_error "Please specify an environment"
            usage
            exit 1
        fi
        sync_env "$2"
        ;;
    *)
        usage
        exit 1
        ;;
esac