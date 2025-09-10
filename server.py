from flask import Flask, request, jsonify
import requests
import hashlib
import hmac
import os

app = Flask(__name__)

# Environment variables
PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY")
DATAMART_API_URL = os.getenv("DATAMART_API_URL", "https://api.datamart.shop/buy")
DATAMART_API_KEY = os.getenv("DATAMART_API_KEY")

@app.route("/", methods=["GET"])
def home():
    return "🚀 Python server is running!"

# --- Initialize Paystack Payment ---
@app.route("/initialize-payment", methods=["POST"])
def initialize_payment():
    try:
        data = request.get_json()
        amount = data.get("amount")
        buyer_number = data.get("buyerNumber")
        recipient_number = data.get("recipientNumber")
        plan = data.get("plan")
        network = data.get("network")

        url = "https://api.paystack.co/transaction/initialize"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"
        }
        body = {
            "amount": amount * 100,  # Paystack expects kobo
            "email": f"{buyer_number}@bangerhitz.app",
            "metadata": {
                "custom_fields": [
                    {"display_name": "Recipient Phone", "variable_name": "recipient_number", "value": recipient_number},
                    {"display_name": "Selected Plan", "variable_name": "selected_plan", "value": plan},
                    {"display_name": "Selected Network", "variable_name": "selected_network", "value": network},
                    {"display_name": "Buyer Number", "variable_name": "buyer_number", "value": buyer_number}
                ]
            }
        }

        response = requests.post(url, json=body, headers=headers)
        return jsonify(response.json()), response.status_code

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Paystack Webhook ---
@app.route("/webhook", methods=["POST"])
def webhook():
    try:
        payload = request.get_data()
        signature = request.headers.get("x-paystack-signature")

        # Verify webhook signature
        hash_value = hmac.new(
            PAYSTACK_SECRET_KEY.encode("utf-8"),
            payload,
            hashlib.sha512
        ).hexdigest()

        if hash_value != signature:
            return "Invalid signature", 400

        event = request.get_json()

        if event["event"] == "charge.success":
            print("✅ Payment successful from Paystack")

            transaction_details = event["data"]
            reference = transaction_details["reference"]

            custom_fields = transaction_details["metadata"]["custom_fields"]
            recipient_number = next((f["value"] for f in custom_fields if f["variable_name"] == "recipient_number"), None)
            selected_plan = next((f["value"] for f in custom_fields if f["variable_name"] == "selected_plan"), None)
            selected_network = next((f["value"] for f in custom_fields if f["variable_name"] == "selected_network"), None)

            # --- Call DataMart API ---
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DATAMART_API_KEY}"
            }
            body = {
                "network": selected_network,
                "plan": selected_plan,
                "recipient": recipient_number
            }

            try:
                datamart_response = requests.post(DATAMART_API_URL, json=body, headers=headers)
                datamart_data = datamart_response.json()

                if datamart_data.get("status") == "success":
                    print(f"✅ DataMart bundle delivered: {selected_plan} to {recipient_number}")
                else:
                    print("❌ Failed to deliver bundle via DataMart:", datamart_data)

            except Exception as e:
                print("🔥 Error calling DataMart API:", str(e))

        return "OK", 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=int(os.getenv("PORT", 3000)), debug=True)
