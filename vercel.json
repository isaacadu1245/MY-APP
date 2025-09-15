{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    },
    {
      "src": "api/ussd.php",
      "use": "@php/php-cgi"
    }
  ],
  "routes": [
    {
      "src": "/api/ussd.php",
      "dest": "api/ussd.php"
    },
    {
      "src": "/(.*)",
      "dest": "/server.js"
    }
  ]
}
