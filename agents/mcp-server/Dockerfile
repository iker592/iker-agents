FROM python:3.13-slim

# Build version to bust cache
ARG BUILD_VERSION=2

WORKDIR /app

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server code
COPY server.py .

# Create non-root user for AgentCore
RUN useradd -m -u 1000 bedrock_agentcore
USER bedrock_agentcore

EXPOSE 8000

# Run the MCP server with streamable HTTP transport
CMD ["python", "server.py"]
