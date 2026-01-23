const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// Middleware to serve your frontend files
app.use(express.static(path.join(__dirname, 'public')));

// The Proxy: Bypasses Instagram's security for your iframe
app.use('/browser-proxy', createProxyMiddleware({
    target: 'https://www.instagram.com',
    changeOrigin: true,
    pathRewrite: { '^/browser-proxy': '' },
    onProxyRes: (proxyRes) => {
        // Forcefully remove headers that block the site from loading in an iframe
        delete proxyRes.headers['x-frame-options'];
        delete proxyRes.headers['content-security-policy'];
        // Ensure cookies (for login) are passed back to you
        proxyRes.headers['access-control-allow-origin'] = '*';
    },
    // Required to keep you logged in across sessions
    cookieDomainRewrite: "" 
}));

app.listen(PORT, () => {
    console.log(`Browser running at http://localhost:${PORT}`);
});
