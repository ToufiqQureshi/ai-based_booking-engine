import razorpay
import sys

# Patch the client method to prevent trailing space in User-Agent header
def patched_update_user_agent_header(self, options):
    user_agent = "{}{}".format('Razorpay-Python/', self._get_version())
    if 'headers' in options:
        options['headers']['User-Agent'] = user_agent
    else:
        options['headers'] = {'User-Agent': user_agent}
    return options

razorpay.Client._update_user_agent_header = patched_update_user_agent_header

key_id = "rzp_test_SuHDIa6RIMTJhm"
key_secret = "AHWn22W3i1XUi0LFrKDPn4iB"

try:
    client = razorpay.Client(auth=(key_id, key_secret))
    order_data = {
        "amount": 1000, # 10 INR in paise
        "currency": "INR",
        "receipt": "test_receipt_123",
        "payment_capture": 1
    }
    order = client.order.create(data=order_data)
    print("SUCCESS:", order)
except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
