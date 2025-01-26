#!/bin/zsh

# Enable error checking for all commands
set -e

# Function to install Xcode Command Line Tools
install_xcode_cli() {
    echo "Installing Xcode Command Line Tools..."
    xcode-select --install &> /dev/null || true
    until xcode-select -p &> /dev/null; do
        sleep 5
    done
    echo "Xcode CLI Tools installed ✓"
}

# Function to install Homebrew
install_homebrew() {
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH
    if [[ $(uname -m) == "arm64" ]]; then
        echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
        source ~/.zshrc
    else
        echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.zshrc
        source ~/.zshrc
    fi
}

# Function to install Node.js
install_node() {
    echo "Installing Node.js..."
    brew install node
    echo "Node.js installed ✓"
    
    # Verify installation
    if ! command -v node &> /dev/null; then
        echo "Failed to install Node.js. Please check permissions."
        exit 1
    fi
}

# Main execution
main() {
    # Check for Xcode CLI Tools
    if ! xcode-select -p &> /dev/null; then
        install_xcode_cli
    else
        echo "Xcode CLI Tools found ✓"
    fi

    # Check for Homebrew
    if ! command -v brew &> /dev/null; then
        install_homebrew
    else
        echo "Homebrew found ✓"
    fi

    # Check for Node.js
    if ! command -v node &> /dev/null; then
        install_node
    else
        echo "Node.js found ✓"
        echo "Node.js version: $(node -v)"
    fi

    # Check for pnpm
    if ! command -v pnpm &> /dev/null; then
        echo "Installing pnpm..."
        npm install -g pnpm
        echo "pnpm installed ✓"
    else
        echo "pnpm found ✓"
    fi

    # Install project dependencies
    echo "Installing project dependencies..."
    pnpm install

    # Build project
    echo "Building project..."
    pnpm run build

    # Run the application
    echo "Starting trading bot..."
    pnpm start
}

# Run main function and handle errors
main || {
    echo " "
    echo "--------------------------------------------------"
    echo "Installation failed. Please check the error messages above."
    echo "For manual setup instructions, refer to the documentation."
    exit 1
}

# Keep terminal open after completion
echo " "
read -n 1 -s -r -p "Press any key to close this window..."
exit 0