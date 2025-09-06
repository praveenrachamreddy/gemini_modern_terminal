# Gemini Modern Terminal

A modern, terminal-like user interface where you can type commands and interact with a Google Gemini-powered AI assistant directly in your browser. This project is built with React, TypeScript, and Tailwind CSS.

## Features

- **Interactive Terminal UI**: A beautiful, responsive terminal interface with a blinking cursor, command history (`ArrowUp`/`ArrowDown`), and tab autocompletion.
- **Rich AI Integration**:
    - `ask <prompt>`: Get a single, streamed response from the AI.
    - `chat`: Enter a persistent, multi-turn conversation with the AI.
    - `search <prompt>`: Ask questions about recent events, with answers grounded by Google Search and including source links.
    - `code <prompt>`: Get expert coding help with formatted code blocks and explanations.
    - `image <prompt>`: Generate images from a text description.
- **Document Chat**:
    - `upload`: Upload local text files (`.txt`, `.md`, etc.).
    - `docs <list|select|clear>`: Manage your uploaded documents.
    - `chatdoc`: Start a chat session where the AI's knowledge is limited to the content of your selected document.
- **Classic Terminal Commands**: Includes familiar commands like `help`, `clear`, `date`, `whoami`, `about`, and a stylized `neofetch`.
- **User-Friendly Outputs**:
    - Code blocks with a "Copy" button.
    - Generated images with a "Download" button.
    - Clickable source links for grounded searches.
- **Zero Backend Required**: Runs entirely in the browser, communicating directly with the Google Gemini API.

## How It Works: Code Structure

The application is a single-page application built with React.

-   **`index.html`**: The main HTML file. It includes the Tailwind CSS CDN, imports Google Fonts, and sets up an `importmap` to handle ES6 module imports for React and the GenAI SDK directly from a CDN.
-   **`index.tsx`**: The entry point for the React application, which mounts the `App` component to the root DOM element.
-   **`App.tsx`**: The root component of the application. It sets up the main layout and renders the `Terminal` component.
-   **`components/Terminal.tsx`**: This is the core of the application. It manages all state, including command history, input values, and terminal output lines. It contains the logic for processing commands, handling user input, and rendering the entire terminal interface. It also orchestrates calls to the Gemini service.
-   **`services/geminiService.ts`**: This module encapsulates all communication with the Google Gemini API. It uses the `@google/genai` SDK to handle different functionalities like single-turn questions, chat sessions, search-grounded queries, code generation, and image generation.
-   **`constants.tsx`**: Contains constant values used throughout the application, such as the welcome message, command lists, `help` text, and ASCII art.
-   **`types.ts`**: Defines the TypeScript types and enums used for structuring data, like the `Line` interface which represents a line of output in the terminal.

## Getting Started: Running Locally

To run this project on your local machine, you'll need Node.js and a package manager like `npm`.

### 1. Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or later recommended)
-   A Google Gemini API Key. You can get one from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 2. Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd gemini-modern-terminal
    ```

2.  **Install dependencies:**
    Since this project is set up to use CDN imports, there are no `node_modules` to install for the core libraries. However, for local development, you will need a development server. We recommend using `vite`.

    ```bash
    npm install -D vite
    ```

3.  **Set up your API Key:**
    The application loads the Gemini API key from `process.env.API_KEY`. The easiest way to provide this for local development is to create a `.env.local` file in the root of your project.

    Create a file named `.env.local` and add your API key:
    ```
    VITE_API_KEY=YOUR_GEMINI_API_KEY_HERE
    ```
    *Note: Vite automatically exposes environment variables prefixed with `VITE_` to the client-side code under `import.meta.env`. You will need to adjust `geminiService.ts` to read from this variable for local development.*

    **Change `geminiService.ts` for local development:**
    Find this line:
    `const API_KEY = process.env.API_KEY;`
    And change it to:
    `const API_KEY = import.meta.env.VITE_API_KEY;`

### 3. Running the Development Server

1.  **Start the app:**
    ```bash
    npx vite
    ```

2.  Open your browser and navigate to the local URL provided by Vite (e.g., `http://localhost:5173`).

## Deployment

This is a static frontend application, so it can be deployed to any static site hosting service or served from a web server like Nginx.

### 1. Building for Production

If you used Vite for local development, you can build the static assets.

1.  **Run the build command:**
    ```bash
    npx vite build
    ```
    This will create a `dist` directory containing the optimized static `index.html`, JavaScript, and CSS files.

### 2. Deploying with Docker

You can containerize the application for easy deployment.

1.  **Create a `Dockerfile`:**
    Create a file named `Dockerfile` in the project root:
    ```Dockerfile
    # Stage 1: Build the application (if using a build step)
    # This example assumes you have a package.json and use Vite to build.
    FROM node:18-alpine AS build
    WORKDIR /app
    COPY package.json package-lock.json ./
    RUN npm install
    COPY . .
    # IMPORTANT: You'll need to pass the API key as a build argument
    # if it's required during the build process.
    RUN npm run build

    # Stage 2: Serve the static files with Nginx
    FROM nginx:1.25-alpine
    WORKDIR /usr/share/nginx/html

    # We need to replace the placeholder API key in the built JS file
    # This is not ideal for security, see the Kubernetes section for a better approach.
    # For now, we will just copy the built files.
    COPY --from=build /app/dist .

    # Copy the Nginx configuration
    COPY nginx.conf /etc/nginx/conf.d/default.conf

    EXPOSE 80
    CMD ["nginx", "-g", "daemon off;"]
    ```

2.  **Create an `nginx.conf` file:**
    ```nginx
    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }
    }
    ```

3.  **Build and run the Docker container:**
    ```bash
    # Build the image
    docker build -t gemini-terminal .

    # Run the container
    docker run -d -p 8080:80 --name gemini-terminal-app gemini-terminal
    ```
    The application will be available at `http://localhost:8080`.

### 3. Deploying to Kubernetes (as a Pod)

For a production environment, you should handle the API key securely using Kubernetes Secrets. The frontend application needs this key, so we will use a ConfigMap and an entrypoint script in the Docker container to inject it at runtime.

1.  **Update `geminiService.ts`:**
    To make the key injectable, we can have it read from a global variable that will be set by a script.
    Change: `const API_KEY = process.env.API_KEY;`
    To: `const API_KEY = window.GEMINI_API_KEY;`

2.  **Update `index.html`:**
    Add a script tag in the `<head>` to set this global variable.
    ```html
    <script>
      window.GEMINI_API_KEY = "__GEMINI_API_KEY__";
    </script>
    <script type="importmap">...</script>
    ```

3.  **Create an `entrypoint.sh` script for your Docker image:**
    ```sh
    #!/bin/sh
    # Replace the placeholder with the environment variable
    sed -i "s|__GEMINI_API_KEY__|${API_KEY}|g" /usr/share/nginx/html/index.html
    # Start Nginx
    exec nginx -g 'daemon off;'
    ```
    Make it executable: `chmod +x entrypoint.sh`

4.  **Update your `Dockerfile` to use the entrypoint:**
    ```Dockerfile
    # (Build stage is the same)
    ...
    # Stage 2: Serve
    FROM nginx:1.25-alpine
    WORKDIR /usr/share/nginx/html
    COPY --from=build /app/dist .
    COPY nginx.conf /etc/nginx/conf.d/default.conf
    COPY entrypoint.sh /entrypoint.sh
    RUN chmod +x /entrypoint.sh

    EXPOSE 80
    ENTRYPOINT ["/entrypoint.sh"]
    ```

5.  **Create Kubernetes Manifests (`deployment.yaml`):**
    ```yaml
    apiVersion: v1
    kind: Secret
    metadata:
      name: gemini-api-key-secret
    type: Opaque
    stringData:
      apiKey: "YOUR_GEMINI_API_KEY_HERE" # Your actual key

    ---
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: gemini-terminal-deployment
      labels:
        app: gemini-terminal
    spec:
      replicas: 2
      selector:
        matchLabels:
          app: gemini-terminal
      template:
        metadata:
          labels:
            app: gemini-terminal
        spec:
          containers:
          - name: gemini-terminal
            image: your-docker-repo/gemini-terminal:latest # Your image pushed to a registry
            ports:
            - containerPort: 80
            env:
            - name: API_KEY
              valueFrom:
                secretKeyRef:
                  name: gemini-api-key-secret
                  key: apiKey
    ---
    apiVersion: v1
    kind: Service
    metadata:
      name: gemini-terminal-service
    spec:
      selector:
        app: gemini-terminal
      ports:
        - protocol: TCP
          port: 80
          targetPort: 80
      type: LoadBalancer # Or ClusterIP/NodePort depending on your needs
    ```

6.  **Apply the manifests:**
    ```bash
    kubectl apply -f deployment.yaml
    ```
    This will create the Secret, deploy your application as Pods managed by a Deployment, and expose it via a Service.
