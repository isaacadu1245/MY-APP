import os
import json
import hmac
import hashlib
import requests

# This is a simple serverless function that handles Paystack webhooks
# and then buys data bundles from DataMart based on the payment amount.

# --- IMPORTANT CONFIGURATION ---
# Store your secret keys as environment variables for security.
# PAYSTACK_SECRET_KEY = os.environ.get('PAYSTACK_SECRET_KEY')
# DATAMART_API_KEY = os.environ.get('DATAMART_API_KEY')

# Mapping of Paystack payment amount (in pesewas) to DataMart data capacity (in GB).
# Adjust these values to match your pricing.
# Example: GHC 7.00 = 700 pesewas, GHC 14.00 = 1400 pesewas
PAYMENT_TO_DATA_CAPACITY = {
    700: '1',    # GHC 7.00 buys 1GB
    1400: '2',   # GHC 14.00 buys 2GB
    2800: '5',   # GHC 28.00 buys 5GB
    5500: '10',  # GHC 55.00 buys 10GB
}

def handle_webhook(request):
    """
    Handles incoming Paystack webhook requests.
    """
    if request.method != 'POST':
        return {
            'statusCode': 405,
            'body': json.dumps('Method Not Allowed')
        }

    # Load environment variables. Raise an error if they are not set.
    try:
        PAYSTACK_SECRET_KEY = os.environ['PAYSTACK_SECRET_KEY']
        DATAMART_API_KEY = os.environ['DATAMART_API_KEY']
    except KeyError as e:
        print(f"Missing required environment variable: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Internal Server Error: Missing required environment variable: {e}")
        }

    try:
        # Get the raw request body and the signature header
        request_body = request.get_data(as_text=True)
        paystack_signature = request.headers.get('x-paystack-signature')

        # Verify the webhook signature for security
        if not verify_paystack_signature(request_body, paystack_signature, PAYSTACK_SECRET_KEY):
            print("Webhook signature verification failed.")
            return {
                'statusCode': 401,
                'body': json.dumps('Invalid signature')
            }

        # Parse the JSON payload from Paystack
        payload = json.loads(request_body)
        
        event_type = payload.get('event')

        # We are only interested in successful transactions
        if event_type == 'charge.success':
            data = payload.get('data')
            amount_paid = data.get('amount')
            phone_number = data.get('customer', {}).get('phone')

            # Ensure we have the necessary data
            if not amount_paid or not phone_number:
                print("Missing amount or phone number in webhook payload.")
                return {
                    'statusCode': 400,
                    'body': json.dumps('Bad Request: Missing data')
                }
            
            # Look up the data capacity based on the amount paid
            capacity = PAYMENT_TO_DATA_CAPACITY.get(amount_paid)

            if not capacity:
                print(f"No matching data capacity found for amount: {amount_paid}")
                return {
                    'statusCode': 404,
                    'body': json.dumps('No data bundle found for this amount')
                }

            # Purchase the data bundle on DataMart
            print(f"Attempting to purchase {capacity}GB for {phone_number}...")
            success, message = purchase_datamart_data(phone_number, capacity, DATAMART_API_KEY)
            
            if success:
                print(f"Successfully purchased {capacity}GB for {phone_number}.")
                return {
                    'statusCode': 200,
                    'body': json.dumps({'status': 'success', 'message': message})
                }
            else:
                print(f"Failed to purchase data: {message}")
                return {
                    'statusCode': 500,
                    'body': json.dumps({'status': 'error', 'message': message})
                }
        else:
            # Acknowledge all other webhook events
            return {
                'statusCode': 200,
                'body': json.dumps('Webhook event received, but not processed')
            }

    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'body': json.dumps('Invalid JSON payload')
        }
    except Exception as e:
        print(f"An error occurred: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Internal Server Error: {str(e)}')
        }

def verify_paystack_signature(body, signature, secret_key):
    """
    Verifies that the request is genuinely from Paystack.
    """
    # Create a HMAC-SHA512 signature using the secret key and request body
    hashed = hmac.new(
        key=secret_key.encode('utf-8'),
        msg=body.encode('utf-8'),
        digestmod=hashlib.sha512
    ).hexdigest()
    
    return hmac.compare_digest(hashed, signature)

def purchase_datamart_data(phone_number, capacity, api_key):
    """
    Makes a POST request to the DataMart API to buy a data bundle.
    """
    DATAMART_URL = 'https://api.datamartgh.shop/api/developer/purchase'

    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': api_key
    }

    payload = {
        "phoneNumber": phone_number,
        "network": "MTN", # You may need to get this from the app's metadata
        "capacity": capacity,
        "gateway": "wallet"
    }

    try:
        response = requests.post(DATAMART_URL, headers=headers, json=payload, timeout=10)
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
        response_data = response.json()
        
        if response_data.get('status') == 'success':
            return True, "Data bundle purchased successfully."
        else:
            return False, response_data.get('message', 'Unknown error from DataMart API.')
            
    except requests.exceptions.RequestException as e:
        return False, f"Failed to connect to DataMart API: {e}"
