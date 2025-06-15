import { SESClient } from "@aws-sdk/client-ses";
 const ses = new SESClient({ region: process.env.AWS_REGION ?? "us-east-1" });

import { SendEmailCommand } from "@aws-sdk/client-ses";

interface SendEmail {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmail) {
  await ses.send(
    new SendEmailCommand({
      Destination: { ToAddresses: [to] },
      Source: "noreply@granite-manager.com/",
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: html ?? "", Charset: "UTF-8" },
          Text: { Data: text ?? "", Charset: "UTF-8" },
        },
      },
    })
  );
}