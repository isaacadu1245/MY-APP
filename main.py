import os
import json
import hmac
import hashlib
import requests
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# --- IMPORTANT CONFIGURATION ---
# The Paystack and DataMart secret keys should be set as environment variables.
# You will need to add these in your Vercel or Render dashboard settings.
# e.g., PAYSTACK_SECRET_KEY, DATAMART_API_KEY, DATAMART_API_URL

# Mapping of Paystack payment amount (in pesewas) to DataMart data capacity (in GB).
# Adjust these values to match your pricing.
PAYMENT_TO_DATA_CAPACITY = {
    700: {'data_amount': '1', 'network': 'MTN', 'planName': 'MTN 1GB'},
    1400: {'data_amount': '2', 'network': 'MTN', 'planName': 'MTN 2GB'},
    2800: {'data_amount': '5', 'network': 'MTN', 'planName': 'MTN 5GB'},
    5500: {'data_amount': '10', 'network': 'MTN', 'planName': 'MTN 10GB'},
}


class handler(BaseHTTPRequestHandler):
    """
    A unified serverless function handler for both payment initialization
    and Paystack webhook processing.
    """
    def do_POST(self):
        """
        Handles POST requests for both payment initialization and webhooks.
        """
        path = urlparse(self.path).path
        
        # Determine the action based on the request path
        if path == '/initialize-payment':
            self.handle_initialize_payment()
        elif path == '/paystack-webhook':
            self.handle_paystack_webhook()
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")

    def handle_initialize_payment(self):
        """
        Initializes a payment with Paystack.
        """
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)

            # Retrieve required data from the request body
            amount = data.get('amount')
            email = data.get('email')
            recipientNumber = data.get('recipientNumber')
            buyerNumber = data.get('buyerNumber')
            network = data.get('network')
            dataAmount = data.get('dataAmount')
            planName = data.get('planName')
            
            if not all([amount, email, recipientNumber, buyerNumber, network, dataAmount, planName]):
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"message": "Missing required fields"}).encode())
                return

            paystack_secret_key = os.environ.get('PAYSTACK_SECRET_KEY')
            if not paystack_secret_key:
                raise ValueError("PAYSTACK_SECRET_KEY not set")

            payload = {
                "email": email,
                "amount": amount, # Paystack expects amount in pesewas
                "metadata": {
                    "recipientNumber": recipientNumber,
                    "buyerNumber": buyerNumber,
                    "network": network,
                    "dataAmount": dataAmount,
                    "planName": planName
                }
            }
            
            headers = {
                'Authorization': f'Bearer {paystack_secret_key}',
                'Content-Type': 'application/json'
            }

            response = requests.post('https://api.paystack.co/transaction/initialize', headers=headers, json=payload)
            response.raise_for_status()
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(response.content)

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"message": f"An error occurred: {str(e)}"}).encode())

    def handle_paystack_webhook(self):
        """
        Handles incoming Paystack webhook requests.
        """
        try:
            # Load environment variables. Raise an error if they are not set.
            paystack_secret_key = os.environ['PAYSTACK_SECRET_KEY']
            datamart_api_key = os.environ['DATAMART_API_KEY']
            datamart_api_url = os.environ['DATAMART_API_URL']
        except KeyError as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"message": f"Internal Server Error: Missing required environment variable: {e}"}).encode())
            return
        
        # Get the raw request body and the signature header
        content_length = int(self.headers['Content-Length'])
        request_body = self.rfile.read(content_length)
        paystack_signature = self.headers.get('x-paystack-signature')

        # Verify the webhook signature for security
        if not self.verify_paystack_signature(request_body, paystack_signature, paystack_secret_key):
            print("Webhook signature verification failed.")
            self.send_response(401)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"message": "Invalid signature"}).encode())
            return

        # Parse the JSON payload from Paystack
        payload = json.loads(request_body)
        
        event_type = payload.get('event')

        # We are only interested in successful transactions
        if event_type == 'charge.success':
            data = payload.get('data')
            metadata = data.get('metadata', {})
            recipient_number = metadata.get('recipientNumber')
            data_amount = metadata.get('dataAmount')
            network = metadata.get('network')

            # Ensure we have the necessary data
            if not all([recipient_number, data_amount, network]):
                print("Missing data in webhook payload.")
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"message": "Bad Request: Missing data"}).encode())
                return
            
            # Purchase the data bundle on DataMart
            print(f"Attempting to purchase {data_amount}GB for {recipient_number}...")
            success, message = self.purchase_datamart_data(recipient_number, data_amount, network, datamart_api_key, datamart_api_url)
            
            if success:
                print(f"Successfully purchased {data_amount}GB for {recipient_number}.")
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'message': message}).encode())
            else:
                print(f"Failed to purchase data: {message}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': message}).encode())
        else:
            # Acknowledge all other webhook events
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"message": f"Internal Server Error: {str(e)}"}).encode())
        
    def verify_paystack_signature(self, body, signature, secret_key):
        """
        Verifies that the request is genuinely from Paystack.
        """
        # Create a HMAC-SHA512 signature using the secret key and request body
        hashed = hmac.new(
            key=secret_key.encode('utf-8'),
            msg=body,
            digestmod=hashlib.sha512
        ).hexdigest()
        
        return hmac.compare_digest(hashed, signature)

    def purchase_datamart_data(self, phone_number, capacity, network, api_key, api_url):
        """
        Makes a POST request to the DataMart API to buy a data bundle.
        """
        headers = {
            'Content-Type': 'application/json',
            'X-API-Key': api_key
        }

        payload = {
            "phoneNumber": phone_number,
            "network": network,
            "capacity": capacity,
            "gateway": "wallet"
        }

        try:
            response = requests.post(api_url, headers=headers, json=payload, timeout=10)
            response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
            response_data = response.json()
            
            if response_data.get('status') == 'success':
                return True, "Data bundle purchased successfully."
            else:
                return False, response_data.get('message', 'Unknown error from DataMart API.')
                
        except requests.exceptions.RequestException as e:
            return False, f"Failed to connect to DataMart API: {e}"

    def do_GET(self):
        """
        Handles GET requests to return a basic status.
        """
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"status": "API is running"}')

