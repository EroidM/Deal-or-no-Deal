import firebase_admin
from firebase_admin import credentials, auth
import json

# The path to your JSON key file, with backslashes replaced with forward slashes.
# This fixes the SyntaxError.
cred = credentials.Certificate('C:/Users/HomePC/Documents/HCKL/Other/Deal-or-no-Deal/deal-or-no-deal-20bf2-firebase-adminsdk-fbsvc-debc9b981e.json')

firebase_admin.initialize_app(cred)

# The user ID you specified.
uid = 'Edwin Bundi'
custom_token = auth.create_custom_token(uid)

print(f"Custom Auth Token for UID '{uid}':")
print(custom_token.decode('utf-8'))
