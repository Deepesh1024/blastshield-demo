FROM codercom/code-server:latest

# Switch to root to copy files and clean up
USER root

# Copy extension files
COPY extensions/blastshield-0.0.10.vsix /tmp/blastshield-0.0.10.vsix
COPY extensions/demo-guide-1.0.0.vsix /tmp/demo-guide-1.0.0.vsix

# Make sure coder user can read the vsix files
RUN chmod 644 /tmp/*.vsix

# Switch back to coder for extension install
USER 1000

# Install both extensions
RUN code-server --install-extension /tmp/blastshield-0.0.10.vsix && \
    code-server --install-extension /tmp/demo-guide-1.0.0.vsix

# Install missing npm dependencies for the demo-guide extension
# (the .vsix doesn't bundle node_modules)
# Need to install npm first as it's not in the base image
USER root
RUN apt-get update && apt-get install -y npm && rm -rf /var/lib/apt/lists/*
RUN cd /home/coder/.local/share/code-server/extensions/blastshield.demo-guide-1.0.0 && \
    npm install --production && \
    chown -R 1000:1000 /home/coder/.local/share/code-server/extensions/blastshield.demo-guide-1.0.0/node_modules

# Clean up
RUN rm -f /tmp/*.vsix

# Create default workspace directory
RUN mkdir -p /home/coder/project && chown 1000:1000 /home/coder/project

# Switch back to coder user for runtime
USER 1000

# Set default theme to Dark Modern
RUN mkdir -p /home/coder/.local/share/code-server/User && \
    echo '{ "workbench.colorTheme": "Default Dark Modern" }' > /home/coder/.local/share/code-server/User/settings.json

# Expose code-server port
EXPOSE 8080

# Start code-server with no authentication, bound to 0.0.0.0
ENTRYPOINT ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none", "--disable-telemetry", "/home/coder/project"]
