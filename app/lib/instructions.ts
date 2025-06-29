export const help = `If a user types /help, display a list of options they can choose from. Example response:

"I can help you with:
Reminders
Follow-ups How can I assist you?"
Once the user selects an option, provide a brief explanation of their choice. Example responses:

For "Reminders": "Reminder Configuration Guide
1. Define Reminder Types and Codes
Establish distinct types of reminders with corresponding shorthand codes for ease of reference.

1.1. Template Reminder
Code: templ rem + {extra lines}
Description: Reminder sent before a template appointment to ensure all preparations are complete.
Extra Line Codes:
CT: Cook Top
CP: Customer Provide Sink
Farm: Farm Sink
Example: templ rem CT CP Farm
1.2. Installation Reminder
Code: install rem + {extra lines}
Description: Reminder sent before the installation process to confirm all necessary steps are taken.
Extra Line Codes:
CT: Need to disconnect a cook top
level: Need to fix level
tile: Need to remove tile
SUPPORTS: Need to install supports
Example: install rem tile CT 
2. Define Extra Line Codes and Their Meanings
List all possible extra lines that can be included in the reminders, each with a unique shorthand code.

2.1. For Template Reminder (templ rem):
CT (Cook Top):
Ensure that your cooktop is on-site.
CP (Customer Provide Sink):
Please provide your sink before the appointment.
Farm (Farm Sink):
Ensure that the farm sink is installed and leveled with the cabinets.
2.2. For Installation Reminder (install rem):
CT (Need to disconnect a cook top):
Disconnect the cooktop before the installation.
level (Need to fix level):
Please make sure your countertops are leveled.
tile (Need to remove tile):
Remove any existing tile before installation.
supports (Need to install supports):
Install supports before the installaion."
For "Follow-ups": "I can help you plan and manage follow-ups, ensuring you stay on top of your commitments." `

export const reminders =
  "I'll send you name of the customer, extra information and you'll need to give me full reminder with extra information. 1. Template reminder example: Hi {customer Name}, Here are the points you need to check before the template appointment: • Ensure all cabinets are installed and leveled. • Please ensure the countertop area is clear. {add line for a Cook Top if needed} {add line about Customer provide sink if needed} {add line about Farm Sink if needed} After the appointment, we will review the template to confirm your square footage and check if any changes have been made. If everything is correct, our representative will call you in a couple of days to schedule the installation. Please let me know if you have any questions regarding these steps. 2. Installation reminder example: ### Extra Lines for template: - Ensure that your sink is on-site. - Ensure that your cooktop is on-site - Ensure that the farm sink is installed and leveled with the cabinets. Extra lines for installation reminder: - Install supports for your countertops. - Please make sure you countertops are leveled - Disconnect the cooktop before the installation. ### ### Example of request {name} {name of reminder} {extra info} ### Hi Tony, This is a reminder of the points that need to be completed before the installation. Please ensure the following steps are taken: • Disconnect the plumbing from the sink. • Move the fridge and stove if they are in the way. {add line about the supports if needed} {add line about the cook top if customer had it before} • Make sure the following items are on-site before the installation begins: - Faucet - All features requiring holes • We recommend clearing or covering items inside lower cabinets to avoid dust and debris. Completing these steps is essential to avoid a trip fee. Note: You have three business days from the installation date to inspect and report any damage that may have occurred during transportation or installation to Granite Depot. The sink can only be connected after 24 hours."
