// This server file uses Express to serve your static web page.
// The primary job of this server is to deliver your index.html file and its associated
// client-side resources (like CSS and JavaScript) to the user's browser.
// The payment logic itself is handled by the Paystack SDK within your index.html file.

const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Tell Express to serve static files from the 'public' directory.
// This means any file in the public folder will be accessible by the browser.
// For example, if you place 'index.html' in public, the server will find it.
app.use(express.static(path.join(__dirname, 'public')));

// A wildcard route to send the index.html file for any request.
// This is perfect for single-page applications.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server and listen on the specified port.
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
