# BlastShield Demo Sandbox

A lightweight, containerized backend to run Visual Studio Code inside the browser. This sandbox dynamically provisions and manages Docker containers running the `code-server` image, allowing users to interact with pre-configured developer environments directly from the web application.

![Docker](public/logo-docker.svg) ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white) 

🔗 **BlastShield Extension**: [GitHub](https://github.com/Deepesh1024/blastshield-extension)

🎥 **Demo Video**: [Watch on YouTube](https://youtu.be/8dSYFwjkyaE)

---

## 🚀 Features

- **On-Demand VS Code Environments**: Dynamically spawns new Docker containers running `code-server` for each project.
- **Pre-Configured Projects**: Includes multiple ready-to-use projects (`CacheStorm`, `CartRush`, `PayFlow`, `QueryBurst`) pre-loaded in the workspaces.
- **Embedded Extensions**: Automatically pre-installs the `blastshield` and `demo-guide` VS Code extensions within the containerized environments.
- **Automatic Port Management**: Dynamically allocates and proxies ports (9000-9100) to ensure isolated environments for different projects/users.
- **Zero-Setup for Users**: Users can jump straight into a fully configured IDE right from their browser without installing anything locally.

## 🛠 Prerequisites

To run this backend locally, you will need:
- **Node.js** (v18 or higher)
- **Docker Desktop** (or Docker Engine) running on your machine.

## 💻 Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Deepesh1024/blastshield-demo.git
   cd blastshield-demo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the base Docker image**
   The application spawns containers from a custom `code-sandbox` image. You need to build this image first:
   ```bash
   docker build -t code-sandbox .
   ```

4. **Start the Sandbox Server**
   ```bash
   npm run dev
   # The server will start on http://localhost:3000
   ```

## ☁️ EC2 Deployment Guide (AWS Console)

To deploy this application to a production AWS EC2 instance without using SSH keys locally, follow these steps using **EC2 Instance Connect**:

1. **Launch an EC2 Instance**:
   - OS: **Ubuntu 24.04 LTS**
   - Instance Type: **t3.medium** (4GB RAM minimum recommended for multiple VS Code environments)
   - Configuration: Ensure you allocate at least **20GB** of storage.
2. **Configure Security Groups**:
   - Inbound Rule: Protocol TCP, Port **3000**, Source `0.0.0.0/0`
   - Inbound Rule: Protocol TCP, Port **9000-9100**, Source `0.0.0.0/0`
3. **Connect via Instance Connect**:
   - Go to your EC2 Dashboard, check the box next to your instance, and click **Connect** -> **EC2 Instance Connect**.
4. **Install Docker**:
   ```bash
   sudo apt-get update && sudo apt-get install -y docker.io
   sudo systemctl enable docker && sudo systemctl start docker
   sudo usermod -aG docker ubuntu
   # WARNING: Type 'exit' to close the terminal, then click 'Connect' again to reload permissions.
   ```
5. **Install Node.js & Setup App**:
   ```bash
   # Install Node (NVM)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   source ~/.bashrc
   nvm install 20
   
   # Clone and Install
   git clone https://github.com/Deepesh1024/blastshield-demo.git
   cd blastshield-demo
   npm install
   
   # Build Docker Image
   docker build -t code-sandbox .
   ```
6. **Run Production Server**:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "demo-sandbox"
   pm2 startup && pm2 save
   ```

## 📁 Project Structure

- `/server.js` - Main entry point. Handles HTTP requests, Docker container orchestration, and proxying.
- `/Dockerfile` - Defines the custom `code-sandbox` image based on `codercom/code-server`.
- `/projects/` - Contains the source code for the dummy projects available in the sandbox.
- `/extensions/` - `.vsix` files for the VS Code extensions integrated into the container.
- `/public/` - Static frontend assets.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
