# **Admin Panel**

This panel is used for monitoring **LiventCord** services.

---

## 🚀 Getting Started

Install dependencies and run the server:

```bash
npm install
npm start
```

---

## ⚙️ Configuration

**Required Enviroment variables:**
The application uses a `.env` file for configuration. Below are the required environment variables:

## **AUTH_TOKEN**:

Authorization token used to authenticate `/health` endpoint checks on the backend services.

## **BACKEND_URLS**:

A comma-separated list of backend service URLs to monitor. Example:
`BACKEND_URLS=http://localhost:5005,http://localhost:5000,http://localhost:8080`
