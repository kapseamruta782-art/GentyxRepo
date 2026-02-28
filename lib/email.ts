// lib/email.ts
import { EmailClient, EmailMessage } from "@azure/communication-email";
import { logEmail, updateEmailLogStatus, type EmailType } from "@/lib/email-logger";

// Create reusable email client using Azure Communication Services
const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING || "";
const emailClient = connectionString ? new EmailClient(connectionString) : null;

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Extended options for email logging context
interface SendEmailWithLoggingOptions extends SendEmailOptions {
  logging?: {
    recipientName?: string;
    recipientRole?: 'CLIENT' | 'CPA' | 'SERVICE_CENTER' | null;
    relatedEntityType?: 'client' | 'cpa' | 'service_center' | null;
    relatedEntityId?: number | null;
    relatedEntityName?: string | null;
    emailType?: EmailType;
    metadata?: Record<string, any>;
  };
}

/**
 * Send an email using Azure Communication Services
 * Includes retry logic with exponential backoff for 429 rate-limiting
 * Optionally logs the email to the database for admin visibility
 */
export async function sendEmail(options: SendEmailOptions | SendEmailWithLoggingOptions) {
  const { to, subject, html, text } = options;
  const logging = 'logging' in options ? options.logging : undefined;

  console.log("📧 sendEmail called with:", { to, subject: subject.substring(0, 50) });
  console.log("📧 ACS Config:", {
    connectionString: process.env.AZURE_COMMUNICATION_CONNECTION_STRING ? "✅ Set" : "❌ Missing",
    sender: process.env.AZURE_EMAIL_SENDER
  });

  // Log the email attempt if logging context is provided
  let emailLogId: number | null = null;
  if (logging) {
    try {
      emailLogId = await logEmail({
        recipientEmail: to,
        recipientName: logging.recipientName,
        recipientRole: logging.recipientRole,
        relatedEntityType: logging.relatedEntityType,
        relatedEntityId: logging.relatedEntityId,
        relatedEntityName: logging.relatedEntityName,
        emailType: logging.emailType || 'general',
        emailSubject: subject,
        emailBodyPreview: html.substring(0, 2000),
        status: 'Pending',
        metadata: logging.metadata,
      });
    } catch (logError) {
      console.error("⚠️ Failed to log email (non-blocking):", logError);
    }
  }

  if (!emailClient) {
    console.error("❌ Email client not initialized - missing AZURE_COMMUNICATION_CONNECTION_STRING");
    if (emailLogId) {
      await updateEmailLogStatus(emailLogId, 'Failed', 'Email client not configured');
    }
    return { success: false, error: "Email client not configured" };
  }

  const sender = process.env.AZURE_EMAIL_SENDER;
  if (!sender) {
    console.error("❌ Missing AZURE_EMAIL_SENDER environment variable");
    if (emailLogId) {
      await updateEmailLogStatus(emailLogId, 'Failed', 'Email sender not configured');
    }
    return { success: false, error: "Email sender not configured" };
  }

  const message: EmailMessage = {
    senderAddress: sender,
    content: {
      subject,
      html,
      plainText: text || html.replace(/<[^>]*>/g, ""),
    },
    recipients: {
      to: [{ address: to }],
    },
  };

  // Retry with exponential backoff: 5s, 10s, 20s, 40s
  const MAX_RETRIES = 5;
  const BASE_DELAY_MS = 5000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`📧 ACS Attempt ${attempt}/${MAX_RETRIES} to send email to ${to}`);

      const poller = await emailClient.beginSend(message);
      const result = await poller.pollUntilDone();

      if (result.status === "Succeeded") {
        console.log("✅ Email sent successfully via ACS:", result.id);
        if (emailLogId) {
          await updateEmailLogStatus(emailLogId, 'Sent', 'Email sent successfully', result.id);
        }
        return { success: true, messageId: result.id };
      } else {
        console.error("❌ ACS send failed with status:", result.status, result.error);
        if (emailLogId) {
          await updateEmailLogStatus(emailLogId, 'Failed', result.error?.message || 'Unknown error');
        }
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      const isRateLimited = error?.statusCode === 429 || error?.code === 'TooManyRequests';

      if (isRateLimited && attempt < MAX_RETRIES) {
        // Exponential backoff: 5s, 10s, 20s, 40s
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`⚠️ ACS rate limited (429). Waiting ${delayMs / 1000}s before retry (attempt ${attempt}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      // Final attempt failed or non-retryable error
      console.error(`❌ ACS email failed (attempt ${attempt}/${MAX_RETRIES}):`, error?.message || error);
      if (emailLogId) {
        await updateEmailLogStatus(emailLogId, 'Failed', error?.message || 'Send error');
      }
      return { success: false, error };
    }
  }

  // Should not reach here
  if (emailLogId) {
    await updateEmailLogStatus(emailLogId, 'Failed', 'Max retries exceeded');
  }
  return { success: false, error: 'Max retries exceeded' };
}


interface MessageNotificationOptions {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  messagePreview: string;
  clientId: number | string;
}

/**
 * Send a message notification email
 */
// ===== WELCOME EMAIL TEMPLATES =====

interface WelcomeEmailOptions {
  recipientEmail: string;
  recipientName: string;
  role: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  password: string;
  additionalInfo?: {
    clientName?: string;
    code?: string;
    centerCode?: string;
    cpaCode?: string;
  };
}

/**
 * Get login URL for the application
 */
function getLoginUrl(): string {
  return 'https://legacy.hubonesystems.net/login';
}

/**
 * Get role-specific information
 */
function getRoleInfo(role: WelcomeEmailOptions['role']): { title: string; dashboardPath: string; icon: string; color: string } {
  switch (role) {
    case 'CLIENT':
      return { title: 'Client', dashboardPath: '/client', icon: '👤', color: '#6366f1' };
    case 'CPA':
      return { title: 'Preparer', dashboardPath: '/cpa', icon: '📊', color: '#10b981' };
    case 'SERVICE_CENTER':
      return { title: 'Service Center', dashboardPath: '/service-center', icon: '🏢', color: '#f59e0b' };
    default:
      return { title: 'User', dashboardPath: '/', icon: '👤', color: '#6366f1' };
  }
}

/**
 * Send a welcome email when a new account is created
 */
export async function sendWelcomeEmail({
  recipientEmail,
  recipientName,
  role,
  password,
  additionalInfo,
}: WelcomeEmailOptions) {
  const roleInfo = getRoleInfo(role);
  const loginUrl = getLoginUrl();
  const currentYear = new Date().getFullYear();
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const subject = `🎉 Welcome to Legacy ClientHub - Your ${roleInfo.title} Account is Ready!`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Legacy ClientHub</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header - Legacy Accounting Services Branding (Outlook Compatible) -->
              <tr>
                <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; padding: 35px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <!-- Company Name - Clean Text Branding -->
                        <div style="margin-bottom: 8px;">
                          <span style="font-size: 26px; color: #d4a574; font-weight: 700; letter-spacing: 2px; font-family: Georgia, 'Times New Roman', serif;">LEGACY</span>
                        </div>
                        <div style="margin-bottom: 20px;">
                          <span style="font-size: 11px; color: #e8d5c4; letter-spacing: 3px; text-transform: uppercase;">ACCOUNTING SERVICES</span>
                        </div>
                        <!-- ClientHub Badge -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto 20px;">
                          <tr>
                            <td bgcolor="#7a3344" style="background-color: #7a3344; padding: 6px 14px; border-radius: 15px;">
                              <span style="font-size: 11px; color: #ffffff; font-weight: 500; letter-spacing: 1px;">ClientHub Portal</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center;">
                        <h1 style="color: #ffffff; margin: 0 0 8px; font-size: 24px; font-weight: 600;">Welcome, ${recipientName}!</h1>
                        <p style="color: #d4a574; margin: 8px 0 0; font-size: 15px; font-weight: 500;">Your Account has been created</p>
                        <p style="color: #cccccc; margin: 8px 0 0; font-size: 12px;">${formattedDate}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Main Content -->
              <tr>
                <td bgcolor="#ffffff" style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${recipientName},</p>
                        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
                          Congratulations! Your <strong style="color: ${roleInfo.color};">${roleInfo.title}</strong> account has been successfully created on Legacy ClientHub. 
                          You can now access the platform using the credentials below.
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Credentials Box -->
                    <tr>
                      <td style="padding: 0 0 30px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-left: 4px solid ${roleInfo.color};">
                          <tr>
                            <td bgcolor="#f8fafc" style="background-color: #f8fafc; border-radius: 12px; padding: 0;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <td style="padding: 24px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td style="padding-bottom: 15px;">
                                    <span style="display: inline-block; background: ${roleInfo.color}; color: white; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">🔐 Your Login Credentials</span>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Email:</td>
                                        <td style="font-size: 15px; color: #1e293b; font-weight: 600;">${recipientEmail}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 0;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Password:</td>
                                        <td style="font-size: 15px; color: #1e293b; font-weight: 600; font-family: 'Courier New', monospace; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; display: inline-block;">${password}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    ${additionalInfo?.clientName || additionalInfo?.code || additionalInfo?.centerCode || additionalInfo?.cpaCode ? `
                    <!-- Additional Info Box -->
                    <tr>
                      <td style="padding: 0 0 30px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #fef3c7; border-radius: 12px; border-left: 4px solid #f59e0b;">
                          <tr>
                            <td style="padding: 20px 24px;">
                              <p style="margin: 0 0 10px; font-size: 14px; color: #92400e; font-weight: 600;">📋 Account Details</p>
                              ${additionalInfo?.clientName ? `<p style="margin: 0 0 5px; font-size: 14px; color: #78350f;"><strong>Client Name:</strong> ${additionalInfo.clientName}</p>` : ''}
                              ${additionalInfo?.code ? `<p style="margin: 0 0 5px; font-size: 14px; color: #78350f;"><strong>Client Code:</strong> ${additionalInfo.code}</p>` : ''}
                              ${additionalInfo?.cpaCode ? `<p style="margin: 0 0 5px; font-size: 14px; color: #78350f;"><strong>Preparer Code:</strong> ${additionalInfo.cpaCode}</p>` : ''}
                              ${additionalInfo?.centerCode ? `<p style="margin: 0; font-size: 14px; color: #78350f;"><strong>Center Code:</strong> ${additionalInfo.centerCode}</p>` : ''}
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    ` : ''}
                    
                    <!-- CTA Button -->
                    <tr>
                      <td style="text-align: center; padding: 10px 0 30px;">
                        <a href="${loginUrl}" 
                           style="display: inline-block; background-color: ${roleInfo.color}; background: linear-gradient(135deg, ${roleInfo.color} 0%, #8b5cf6 100%); color: white; font-size: 16px; font-weight: 600; padding: 16px 40px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                          Login to Your Account →
                        </a>
                      </td>
                    </tr>

                    <!-- Steps to Login -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f0fdf4; border-radius: 12px; border: 1px solid #86efac;">
                          <tr>
                            <td style="padding: 24px;">
                              <p style="margin: 0 0 15px; font-size: 16px; color: #166534; font-weight: 600;">📋 Steps to Login</p>
                              <ol style="margin: 0; padding-left: 20px; color: #166534; font-size: 14px; line-height: 1.8;">
                                <li>Open your web browser and go to <a href="${loginUrl}" style="color: #059669; font-weight: 600;">${loginUrl}</a></li>
                                <li>Enter your email: <strong>${recipientEmail}</strong></li>
                                <li>Enter your password: <strong style="font-family: 'Courier New', monospace;">${password}</strong></li>
                                <li>Click the <strong>"Sign In"</strong> button</li>
                                <li>You will be redirected to your ${roleInfo.title} dashboard</li>
                              </ol>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Password Reset Instructions -->
                    <tr>
                      <td style="padding: 0 0 20px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #eff6ff; border-radius: 12px; border: 1px solid #93c5fd;">
                          <tr>
                            <td style="padding: 24px;">
                              <p style="margin: 0 0 15px; font-size: 16px; color: #1e40af; font-weight: 600;">🔒 How to Reset Your Password</p>
                              <p style="margin: 0 0 12px; font-size: 14px; color: #1e40af; line-height: 1.6;">
                                For security reasons, we recommend changing your password after your first login. Here's how:
                              </p>
                              <ol style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px; line-height: 1.8;">
                                <li>Log in to your account using the credentials above</li>
                                <li>Click on the <strong>"Settings"</strong> tab in the navigation menu</li>
                                <li>Navigate to the <strong>"Security"</strong> or <strong>"Password"</strong> section</li>
                                <li>Enter your current password</li>
                                <li>Enter and confirm your new password</li>
                                <li>Click <strong>"Update Password"</strong> to save your changes</li>
                              </ol>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Security Notice -->
                    <tr>
                      <td style="padding: 20px 0 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">
                          <tr>
                            <td style="padding: 16px;">
                              <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.5;">
                                ⚠️ <strong>Security Notice:</strong> Keep your login credentials safe and do not share them with anyone. If you suspect unauthorized access to your account, please change your password immediately.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer - Legacy Accounting Services Branding (Outlook Compatible) -->
              <tr>
                <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; padding: 30px 40px; border-radius: 0 0 16px 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 8px; font-size: 14px; color: #d4a574; font-weight: 600;">Legacy Accounting Services</p>
                        <p style="margin: 0 0 10px; font-size: 12px; color: #cccccc;">ClientHub Portal</p>
                        <p style="margin: 0 0 15px; font-size: 12px; color: #999999;">Need help? Contact our support team.</p>
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="border-top: 1px solid #7a3344; padding-top: 15px; text-align: center;">
                              <p style="margin: 0; font-size: 11px; color: #999999;">© ${currentYear} Legacy Accounting Services – All Rights Reserved.</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Map role to email type for logging
  const emailTypeMap: Record<string, EmailType> = {
    'CLIENT': 'welcome_client',
    'CPA': 'welcome_cpa',
    'SERVICE_CENTER': 'welcome_service_center',
  };

  // Map role to entity type for logging
  const entityTypeMap: Record<string, 'client' | 'cpa' | 'service_center'> = {
    'CLIENT': 'client',
    'CPA': 'cpa',
    'SERVICE_CENTER': 'service_center',
  };

  return sendEmail({
    to: recipientEmail,
    subject,
    html,
    logging: {
      recipientName,
      recipientRole: role,
      relatedEntityType: entityTypeMap[role],
      relatedEntityName: additionalInfo?.clientName || recipientName,
      emailType: emailTypeMap[role] || 'general',
      metadata: {
        ...additionalInfo,
        welcomeEmailType: true,
      },
    },
  });
}

// ===== CONVENIENCE FUNCTIONS FOR EACH ROLE =====

/**
 * Send welcome email for a new Client
 */
export async function sendClientWelcomeEmail(
  email: string,
  name: string,
  clientName?: string,
  code?: string
) {
  return sendWelcomeEmail({
    recipientEmail: email,
    recipientName: name,
    role: 'CLIENT',
    password: 'ClientHub@2025',
    additionalInfo: { clientName, code },
  });
}

/**
 * Send welcome email for a new CPA
 */
export async function sendCpaWelcomeEmail(
  email: string,
  name: string,
  cpaCode?: string
) {
  return sendWelcomeEmail({
    recipientEmail: email,
    recipientName: name,
    role: 'CPA',
    password: 'Preparer@12345',
    additionalInfo: { cpaCode },
  });
}

/**
 * Send welcome email for a new Service Center
 */
export async function sendServiceCenterWelcomeEmail(
  email: string,
  name: string,
  centerCode?: string
) {
  return sendWelcomeEmail({
    recipientEmail: email,
    recipientName: name,
    role: 'SERVICE_CENTER',
    password: 'ServiceCenter@2025',
    additionalInfo: { centerCode },
  });
}

// ===== NOTIFICATION EMAIL TEMPLATES =====

interface UpdateNotificationOptions {
  recipientEmail: string;
  recipientName: string;
  updateType: 'profile_updated' | 'task_assigned' | 'document_uploaded' | 'stage_changed' | 'message_received';
  details: {
    title: string;
    description: string;
    actionUrl?: string;
    actionLabel?: string;
  };
}

/**
 * Send a general update/notification email
 */
export async function sendUpdateNotification({
  recipientEmail,
  recipientName,
  updateType,
  details,
}: UpdateNotificationOptions) {
  const typeConfig: Record<string, { icon: string; color: string; label: string }> = {
    profile_updated: { icon: '✏️', color: '#8b5cf6', label: 'Profile Update' },
    task_assigned: { icon: '📋', color: '#3b82f6', label: 'New Task' },
    document_uploaded: { icon: '📄', color: '#10b981', label: 'New Document' },
    stage_changed: { icon: '🚀', color: '#f59e0b', label: 'Stage Update' },
    message_received: { icon: '💬', color: '#6366f1', label: 'New Message' },
  };

  const config = typeConfig[updateType] || typeConfig.profile_updated;
  const currentYear = new Date().getFullYear();
  const formattedDateTime = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const subject = `${config.icon} ${config.label}: ${details.title} - Legacy ClientHub`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${config.label} Notification</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header - Legacy Accounting Services Branding (Outlook Compatible) -->
              <tr>
                <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; padding: 30px 40px 25px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <!-- Company Name - Clean Text Branding -->
                        <div style="margin-bottom: 5px;">
                          <span style="font-size: 22px; color: #d4a574; font-weight: 700; letter-spacing: 2px; font-family: Georgia, 'Times New Roman', serif;">LEGACY</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                          <span style="font-size: 10px; color: #e8d5c4; letter-spacing: 2px;">ACCOUNTING SERVICES</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center;">
                        <h1 style="color: #ffffff; margin: 0 0 5px; font-size: 20px; font-weight: 600;">${config.label}</h1>
                        <p style="color: #cccccc; margin: 0; font-size: 12px;">${formattedDateTime}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td bgcolor="#ffffff" style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${recipientName},</p>
                      </td>
                    </tr>
                    
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-left: 4px solid ${config.color};">
                          <tr>
                            <td bgcolor="#f8fafc" style="background-color: #f8fafc; border-radius: 12px; padding: 24px;">
                              <h3 style="margin: 0 0 12px; font-size: 18px; color: #1e293b;">${details.title}</h3>
                              <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">${details.description}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    ${details.actionUrl ? `
                    <tr>
                      <td style="text-align: center; padding: 10px 0 20px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                          <tr>
                            <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; border-radius: 10px; padding: 14px 36px;">
                              <a href="${details.actionUrl}" style="color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none;">
                                ${details.actionLabel || 'View Details'} →
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    ` : ''}
                  </table>
                </td>
              </tr>
              
              <!-- Footer - Legacy Accounting Services Branding (Outlook Compatible) -->
              <tr>
                <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; padding: 30px 40px; border-radius: 0 0 16px 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 8px; font-size: 14px; color: #d4a574; font-weight: 600;">Legacy Accounting Services</p>
                        <p style="margin: 0 0 15px; font-size: 12px; color: #999999;">Client Portal - Automated Notification</p>
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="border-top: 1px solid #7a3344; padding-top: 15px; text-align: center;">
                              <p style="margin: 0; font-size: 11px; color: #999999;">© ${currentYear} Legacy Accounting Services – All Rights Reserved.</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: recipientEmail,
    subject,
    html,
  });
}

export async function sendMessageNotification({
  recipientEmail,
  recipientName,
  senderName,
  messagePreview,
  clientId,
}: MessageNotificationOptions) {
  const subject = `📬 New Message from ${senderName} - Legacy ClientHub`;
  const currentYear = new Date().getFullYear();
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const formattedDateTime = `${formattedDate} at ${formattedTime}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Message Notification</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header - Legacy Accounting Services Branding (Outlook Compatible) -->
              <tr>
                <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; padding: 30px 40px 25px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <!-- Company Name - Clean Text Branding -->
                        <div style="margin-bottom: 5px;">
                          <span style="font-size: 22px; color: #d4a574; font-weight: 700; letter-spacing: 2px; font-family: Georgia, 'Times New Roman', serif;">LEGACY</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                          <span style="font-size: 10px; color: #e8d5c4; letter-spacing: 2px;">ACCOUNTING SERVICES</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center;">
                        <h1 style="color: #ffffff; margin: 0 0 5px; font-size: 20px; font-weight: 600;">New Message Received</h1>
                        <p style="color: #cccccc; margin: 0; font-size: 12px;">${formattedDateTime}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Main Content -->
              <tr>
                <td bgcolor="#ffffff" style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${recipientName},</p>
                        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">You have received a new message from <strong style="color: #5a1f2d;">${senderName}</strong>:</p>
                      </td>
                    </tr>
                    
                    <!-- Message Box -->
                    <tr>
                      <td style="padding: 0 0 30px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-left: 4px solid #5a1f2d;">
                          <tr>
                            <td bgcolor="#f8fafc" style="background-color: #f8fafc; border-radius: 12px; padding: 24px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                      <tr>
                                        <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; padding: 4px 10px; border-radius: 20px;">
                                          <span style="font-size: 11px; color: #ffffff; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Message Preview</span>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="font-size: 15px; color: #334155; line-height: 1.7;">
                                    "${messagePreview.length > 250 ? messagePreview.substring(0, 250) + '...' : messagePreview}"
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                      <td style="text-align: center; padding: 10px 0 20px;">
                        <p style="margin: 0 0 20px; font-size: 14px; color: #64748b;">Log in to your account to view the full message and reply.</p>
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                          <tr>
                            <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; border-radius: 10px; padding: 14px 36px;">
                              <a href="${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://clienthub.mysage.com'}" style="color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none;">
                                View Message →
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer - Legacy Accounting Services Branding (Outlook Compatible) -->
              <tr>
                <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; padding: 30px 40px; border-radius: 0 0 16px 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 8px; font-size: 14px; color: #d4a574; font-weight: 600;">Legacy Accounting Services</p>
                        <p style="margin: 0 0 10px; font-size: 12px; color: #cccccc;">Client Portal - Automated Notification</p>
                        <p style="margin: 0 0 15px; font-size: 11px; color: #999999;">Please do not reply directly to this email.</p>
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="border-top: 1px solid #7a3344; padding-top: 15px; text-align: center;">
                              <p style="margin: 0; font-size: 11px; color: #999999;">© ${currentYear} Legacy Accounting Services – All Rights Reserved.</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: recipientEmail,
    subject,
    html,
  });
}

// ===== TASK NOTIFICATION EMAIL TEMPLATES =====

interface TaskNotificationOptions {
  recipientEmail: string;
  recipientName: string;
  recipientRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  taskTitle: string;
  taskDescription?: string;
  dueDate?: string;
  clientName: string;
  notificationType: 'assigned' | 'updated';
  updatedFields?: string[]; // For updates, list what changed
  assignedByName?: string;
}

/**
 * Get role-specific styling for task notifications
 */
function getTaskNotificationRoleConfig(role: TaskNotificationOptions['recipientRole']): {
  icon: string;
  color: string;
  title: string;
  dashboardUrl: string;
} {
  const baseUrl = 'https://legacy.hubonesystems.net';

  switch (role) {
    case 'CLIENT':
      return {
        icon: '👤',
        color: '#6366f1',
        title: 'Client',
        dashboardUrl: `${baseUrl}/client`
      };
    case 'CPA':
      return {
        icon: '📊',
        color: '#10b981',
        title: 'Preparer',
        dashboardUrl: `${baseUrl}/cpa`
      };
    case 'SERVICE_CENTER':
      return {
        icon: '🏢',
        color: '#f59e0b',
        title: 'Service Center',
        dashboardUrl: `${baseUrl}/servicecenter`
      };
    default:
      return {
        icon: '📋',
        color: '#6366f1',
        title: 'User',
        dashboardUrl: baseUrl
      };
  }
}

/**
 * Send a task notification email (for new task assignment or task update)
 */
export async function sendTaskNotificationEmail({
  recipientEmail,
  recipientName,
  recipientRole,
  taskTitle,
  taskDescription,
  dueDate,
  clientName,
  notificationType,
  updatedFields,
  assignedByName,
}: TaskNotificationOptions) {
  const roleConfig = getTaskNotificationRoleConfig(recipientRole);
  const currentYear = new Date().getFullYear();
  const formattedDateTime = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const isNewTask = notificationType === 'assigned';
  const headerIcon = isNewTask ? '📋' : '✏️';
  const headerTitle = isNewTask ? 'New Task Assigned' : 'Task Updated';
  const headerColor = isNewTask ? '#3b82f6' : '#f59e0b';

  const subject = isNewTask
    ? `📋 New Task Assigned: ${taskTitle} - Legacy ClientHub`
    : `✏️ Task Updated: ${taskTitle} - Legacy ClientHub`;

  // Format due date nicely
  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    : 'Not specified';

  // Check if task is overdue
  const isOverdue = dueDate && new Date(dueDate) < new Date();
  const dueDateColor = isOverdue ? '#dc2626' : '#059669';
  const dueDateLabel = isOverdue ? '⚠️ OVERDUE' : '📅 Due Date';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${headerTitle}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header - Legacy Accounting Services Branding -->
              <tr>
                <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; background: linear-gradient(135deg, #5a1f2d 0%, #722f3e 50%, #8b3d4d 100%); padding: 30px 40px 25px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <!-- Company Name - Clean Text Branding -->
                        <div style="margin-bottom: 5px;">
                          <span style="font-size: 22px; color: #d4a574; font-weight: 700; letter-spacing: 2px; font-family: Georgia, 'Times New Roman', serif;">LEGACY</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                          <span style="font-size: 10px; color: rgba(255,255,255,0.85); letter-spacing: 2px;">ACCOUNTING SERVICES</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center;">
                        <h1 style="color: white; margin: 0 0 5px; font-size: 20px; font-weight: 600;">${headerTitle}</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 12px;">${formattedDateTime}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${recipientName},</p>
                        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
                          ${isNewTask
      ? `A new task has been assigned to you${assignedByName ? ` by <strong>${assignedByName}</strong>` : ''} for client <strong style="color: ${roleConfig.color};">${clientName}</strong>.`
      : `A task assigned to you for client <strong style="color: ${roleConfig.color};">${clientName}</strong> has been updated.`
    }
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Task Details Box -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border-left: 4px solid ${headerColor};">
                          <tr>
                            <td style="padding: 24px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td style="padding-bottom: 15px;">
                                    <span style="display: inline-block; background: ${headerColor}; color: white; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">📋 Task Details</span>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Task:</td>
                                        <td style="font-size: 16px; color: #1e293b; font-weight: 600;">${taskTitle}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ${taskDescription ? `
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Description:</td>
                                        <td style="font-size: 14px; color: #475569;">${taskDescription}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ` : ''}
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Client:</td>
                                        <td style="font-size: 14px; color: #1e293b; font-weight: 500;">${clientName}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">${dueDateLabel}:</td>
                                        <td style="font-size: 14px; color: ${dueDateColor}; font-weight: 600;">${formattedDueDate}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td>
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Your Role:</td>
                                        <td>
                                          <span style="display: inline-block; background: ${roleConfig.color}; color: white; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px;">
                                            ${roleConfig.icon} ${roleConfig.title}
                                          </span>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    ${!isNewTask && updatedFields && updatedFields.length > 0 ? `
                    <!-- What Changed Box -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #fef3c7; border-radius: 12px; border-left: 4px solid #f59e0b;">
                          <tr>
                            <td style="padding: 20px 24px;">
                              <p style="margin: 0 0 10px; font-size: 14px; color: #92400e; font-weight: 600;">📝 What Changed</p>
                              <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px; line-height: 1.8;">
                                ${updatedFields.map(field => `<li>${field}</li>`).join('')}
                              </ul>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    ` : ''}
                    
                    <!-- CTA Button -->
                    <tr>
                      <td style="text-align: center; padding: 10px 0 25px;">
                        <a href="${roleConfig.dashboardUrl}" 
                           style="display: inline-block; background-color: ${headerColor}; background: linear-gradient(135deg, ${headerColor} 0%, #8b5cf6 100%); color: white; font-size: 15px; font-weight: 600; padding: 14px 36px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                          View My Tasks →
                        </a>
                      </td>
                    </tr>

                    <!-- Action Required Notice -->
                    <tr>
                      <td style="padding: 0 0 20px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f0fdf4; border-radius: 12px; border: 1px solid #86efac;">
                          <tr>
                            <td style="padding: 20px 24px;">
                              <p style="margin: 0 0 10px; font-size: 14px; color: #166534; font-weight: 600;">✅ Action Required</p>
                              <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.6;">
                                Please log in to your Legacy ClientHub account to view the complete task details and take necessary action${dueDate ? ` before the due date` : ''}.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer - Legacy Accounting Services Branding -->
              <tr>
                <td style="background-color: #5a1f2d; padding: 30px 40px; border-radius: 0 0 16px 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 8px; font-size: 14px; color: #d4a574; font-weight: 600;">Legacy Accounting Services</p>
                        <p style="margin: 0 0 10px; font-size: 12px; color: rgba(255,255,255,0.7);">Client Portal - Automated Notification</p>
                        <p style="margin: 0 0 15px; font-size: 11px; color: rgba(255,255,255,0.5);">Please do not reply directly to this email.</p>
                        <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.5);">© ${currentYear} Legacy Accounting Services – All Rights Reserved.</p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: recipientEmail,
    subject,
    html,
  });
}

// ===== ONBOARDING TASK NOTIFICATION =====

interface OnboardingTaskNotificationOptions {
  recipientEmail: string;
  recipientName: string;
  recipientRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  stageName: string;
  subtaskTitle: string;
  clientName: string;
  notificationType: 'assigned' | 'updated' | 'completed';
  dueDate?: string;
  assignedByName?: string;
}

/**
 * Send notification for onboarding task/subtask assignment or update
 */
export async function sendOnboardingTaskNotificationEmail({
  recipientEmail,
  recipientName,
  recipientRole,
  stageName,
  subtaskTitle,
  clientName,
  notificationType,
  dueDate,
  assignedByName,
}: OnboardingTaskNotificationOptions) {
  const roleConfig = getTaskNotificationRoleConfig(recipientRole);
  const currentYear = new Date().getFullYear();
  const formattedDateTime = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  let headerIcon = '📋';
  let headerTitle = 'Onboarding Task Assigned';
  let headerColor = '#3b82f6';

  if (notificationType === 'updated') {
    headerIcon = '✏️';
    headerTitle = 'Onboarding Task Updated';
    headerColor = '#f59e0b';
  } else if (notificationType === 'completed') {
    headerIcon = '✅';
    headerTitle = 'Onboarding Task Completed';
    headerColor = '#10b981';
  }

  const subject = `${headerIcon} ${headerTitle}: ${subtaskTitle} - Legacy Accounting Services`;

  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    : null;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${headerTitle}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header - Legacy Accounting Services Branding -->
              <tr>
                <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; background: linear-gradient(135deg, #5a1f2d 0%, #722f3e 50%, #8b3d4d 100%); padding: 30px 40px 25px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <!-- Company Name - Clean Text Branding -->
                        <div style="margin-bottom: 5px;">
                          <span style="font-size: 22px; color: #d4a574; font-weight: 700; letter-spacing: 2px; font-family: Georgia, 'Times New Roman', serif;">LEGACY</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                          <span style="font-size: 10px; color: rgba(255,255,255,0.85); letter-spacing: 2px;">ACCOUNTING SERVICES</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center;">
                        <h1 style="color: white; margin: 0 0 5px; font-size: 20px; font-weight: 600;">${headerTitle}</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 12px;">${formattedDateTime}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${recipientName},</p>
                        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
                          ${notificationType === 'assigned'
      ? `An onboarding task has been assigned to you${assignedByName ? ` by <strong>${assignedByName}</strong>` : ''} for client <strong style="color: ${roleConfig.color};">${clientName}</strong>.`
      : notificationType === 'updated'
        ? `An onboarding task for client <strong style="color: ${roleConfig.color};">${clientName}</strong> has been updated.`
        : `An onboarding task for client <strong style="color: ${roleConfig.color};">${clientName}</strong> has been completed.`
    }
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Task Details Box -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border-left: 4px solid ${headerColor};">
                          <tr>
                            <td style="padding: 24px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td style="padding-bottom: 15px;">
                                    <span style="display: inline-block; background: ${headerColor}; color: white; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">🚀 Onboarding Details</span>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Stage:</td>
                                        <td style="font-size: 14px; color: #1e293b; font-weight: 600;">${stageName}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Task:</td>
                                        <td style="font-size: 16px; color: #1e293b; font-weight: 600;">${subtaskTitle}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Client:</td>
                                        <td style="font-size: 14px; color: #1e293b; font-weight: 500;">${clientName}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ${formattedDueDate ? `
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">📅 Due Date:</td>
                                        <td style="font-size: 14px; color: #059669; font-weight: 600;">${formattedDueDate}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ` : ''}
                                <tr>
                                  <td>
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Your Role:</td>
                                        <td>
                                          <span style="display: inline-block; background: ${roleConfig.color}; color: white; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px;">
                                            ${roleConfig.icon} ${roleConfig.title}
                                          </span>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                      <td style="text-align: center; padding: 10px 0 25px;">
                        <a href="${roleConfig.dashboardUrl}" 
                           style="display: inline-block; background-color: #5a1f2d; background: linear-gradient(135deg, #5a1f2d 0%, #8b3d4d 100%); color: white; font-size: 15px; font-weight: 600; padding: 14px 36px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(90, 31, 45, 0.4);">
                          View My Dashboard →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer - Legacy Accounting Services Branding -->
              <tr>
                <td style="background-color: #5a1f2d; padding: 30px 40px; border-radius: 0 0 16px 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 8px; font-size: 14px; color: #d4a574; font-weight: 600;">Legacy Accounting Services</p>
                        <p style="margin: 0 0 15px; font-size: 12px; color: rgba(255,255,255,0.5);">Client Portal - Automated Notification</p>
                        <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.5);">© ${currentYear} Legacy Accounting Services – All Rights Reserved.</p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: recipientEmail,
    subject,
    html,
  });
}


// ===== CLIENT ONBOARDING OVERVIEW EMAIL =====

interface OnboardingStage {
  name: string;
  status: string;
  subtasks?: {
    title: string;
    status: string;
    due_date?: string;
  }[];
}

interface OnboardingOverviewOptions {
  recipientEmail: string;
  recipientName: string;
  clientName: string;
  stages: OnboardingStage[];
  loginUrl?: string;
}

/**
 * Send an onboarding overview email to a client with all their stages and tasks
 */
export async function sendOnboardingOverviewEmail({
  recipientEmail,
  recipientName,
  clientName,
  stages,
  loginUrl = 'https://legacy.hubonesystems.net/login',
}: OnboardingOverviewOptions) {
  console.log(`📧 sendOnboardingOverviewEmail called for ${recipientEmail}`);

  const currentYear = new Date().getFullYear();
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Build stages HTML
  const stagesHtml = stages.map((stage, index) => {
    const stageStatus = stage.status || 'Not Started';
    const statusColor = stageStatus === 'Completed' ? '#10b981' :
      stageStatus === 'In Progress' ? '#f59e0b' : '#6b7280';
    const statusBg = stageStatus === 'Completed' ? '#ecfdf5' :
      stageStatus === 'In Progress' ? '#fef3c7' : '#f3f4f6';

    // Build subtasks HTML if they exist
    const subtasksHtml = stage.subtasks && stage.subtasks.length > 0
      ? stage.subtasks.map((task, taskIndex) => {
        const taskStatus = task.status || 'Not Started';
        const taskStatusColor = taskStatus === 'Completed' ? '#10b981' :
          taskStatus === 'In Progress' ? '#f59e0b' : '#6b7280';
        const dueDate = task.due_date
          ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';

        const taskBgColor = taskStatus === 'Completed' ? '#ecfdf5' :
          taskStatus === 'In Progress' ? '#fffbeb' : '#f3f4f6';

        return `
            <tr>
              <td style="padding: 8px 0 8px 24px; border-bottom: 1px solid #e5e7eb;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="width: 20px; font-size: 12px; color: #9ca3af;">${taskIndex + 1}.</td>
                    <td style="font-size: 14px; color: #374151;">${task.title}</td>
                    <td style="text-align: right; width: 100px; font-size: 12px; color: #9ca3af;">${dueDate}</td>
                    <td style="text-align: right; width: 85px;">
                      <span style="display: inline-block; background-color: ${taskBgColor}; color: ${taskStatusColor}; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 10px;">${taskStatus}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `;
      }).join('')
      : `
        <tr>
          <td style="padding: 12px 24px; color: #9ca3af; font-size: 13px; font-style: italic;">No tasks assigned yet</td>
        </tr>
      `;

    return `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <tr>
          <td bgcolor="#f8fafc" style="background-color: #f8fafc; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="font-size: 12px; color: #6b7280; font-weight: 500;">STAGE ${index + 1}</td>
                <td style="text-align: right;">
                  <span style="display: inline-block; background: ${statusBg}; color: ${statusColor}; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 10px; text-transform: uppercase;">${stageStatus}</span>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top: 6px; font-size: 16px; color: #1e293b; font-weight: 600;">${stage.name}</td>
              </tr>
            </table>
          </td>
        </tr>
        ${subtasksHtml}
      </table>
    `;
  }).join('');

  const subject = `📋 Your Onboarding Journey Overview - ${clientName} - Legacy Accounting Services`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Onboarding Overview</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header - Legacy Accounting Services Branding -->
              <tr>
                <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; background: linear-gradient(135deg, #5a1f2d 0%, #722f3e 50%, #8b3d4d 100%); padding: 30px 40px 25px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <!-- Company Name - Clean Text Branding -->
                        <div style="margin-bottom: 5px;">
                          <span style="font-size: 22px; color: #d4a574; font-weight: 700; letter-spacing: 2px; font-family: Georgia, 'Times New Roman', serif;">LEGACY</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                          <span style="font-size: 10px; color: rgba(255,255,255,0.85); letter-spacing: 2px;">ACCOUNTING SERVICES</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center;">
                        <h1 style="color: white; margin: 0 0 5px; font-size: 20px; font-weight: 600;">Your Onboarding Overview</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 12px;">${formattedDate}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${recipientName},</p>
                        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
                          Below is a summary of your onboarding journey for <strong style="color: #5a1f2d;">${clientName}</strong>. 
                          This shows all the stages and tasks you need to complete for a successful onboarding.
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Info Box -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe;">
                          <tr>
                            <td style="padding: 16px 20px;">
                              <p style="margin: 0; font-size: 14px; color: #1e40af; font-weight: 500;">
                                ℹ️ You have <strong>${stages.length}</strong> onboarding stage${stages.length !== 1 ? 's' : ''} to complete.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Stages List -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        ${stagesHtml}
                      </td>
                    </tr>
                    
                    <!-- Action Required Box -->
                    <tr>
                      <td style="padding: 0 0 20px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f0fdf4; border-radius: 12px; border: 1px solid #86efac;">
                          <tr>
                            <td style="padding: 20px 24px;">
                              <p style="margin: 0 0 10px; font-size: 14px; color: #166534; font-weight: 600;">✅ Ready to start?</p>
                              <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.6;">
                                Log in to your Legacy ClientHub account to view detailed task instructions, upload documents, and track your progress.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                      <td style="text-align: center; padding: 10px 0 0;">
                        <a href="${loginUrl}" 
                           style="display: inline-block; background-color: #5a1f2d; background: linear-gradient(135deg, #5a1f2d 0%, #8b3d4d 100%); color: white; font-size: 15px; font-weight: 600; padding: 14px 36px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(90, 31, 45, 0.4);">
                          View My Dashboard →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer - Legacy Accounting Services Branding -->
              <tr>
                <td style="background-color: #5a1f2d; padding: 30px 40px; border-radius: 0 0 16px 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 8px; font-size: 14px; color: #d4a574; font-weight: 600;">Legacy Accounting Services</p>
                        <p style="margin: 0 0 10px; font-size: 12px; color: rgba(255,255,255,0.7);">Client Portal - Automated Notification</p>
                        <p style="margin: 0 0 15px; font-size: 11px; color: rgba(255,255,255,0.5);">Please do not reply directly to this email.</p>
                        <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.5);">© ${currentYear} Legacy Accounting Services – All Rights Reserved.</p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: recipientEmail,
    subject,
    html,
  });
}


// ===== ADMIN NOTIFICATION EMAILS =====

interface AdminTaskCompletionOptions {
  adminEmail: string;
  adminName: string;
  taskTitle: string;
  clientName: string;
  completedByRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  completedByName: string;
  taskType: 'ASSIGNED' | 'ONBOARDING';
  stageName?: string; // For onboarding tasks
}

/**
 * Send notification to admin when a task is completed
 */
export async function sendAdminTaskCompletionEmail({
  adminEmail,
  adminName,
  taskTitle,
  clientName,
  completedByRole,
  completedByName,
  taskType,
  stageName,
}: AdminTaskCompletionOptions) {
  console.log(`📧 sendAdminTaskCompletionEmail called for ${adminEmail}`);

  const currentYear = new Date().getFullYear();
  const formattedDateTime = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const roleLabels: Record<string, string> = {
    'CLIENT': 'Client',
    'CPA': 'Preparer',
    'SERVICE_CENTER': 'Service Center',
  };

  const taskTypeLabel = taskType === 'ONBOARDING' ? 'Onboarding Task' : 'Assigned Task';
  const roleLabel = roleLabels[completedByRole] || completedByRole;

  const subject = `✅ Task Completed: ${taskTitle} - ${clientName}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Task Completed</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header - Legacy Accounting Services Branding -->
              <tr>
                <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; background: linear-gradient(135deg, #5a1f2d 0%, #722f3e 50%, #8b3d4d 100%); padding: 30px 40px 25px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <!-- Company Name - Clean Text Branding -->
                        <div style="margin-bottom: 5px;">
                          <span style="font-size: 22px; color: #d4a574; font-weight: 700; letter-spacing: 2px; font-family: Georgia, 'Times New Roman', serif;">LEGACY</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                          <span style="font-size: 10px; color: rgba(255,255,255,0.85); letter-spacing: 2px;">ACCOUNTING SERVICES</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center;">
                        <span style="font-size: 50px;">✅</span>
                        <h1 style="color: white; margin: 15px 0 0; font-size: 24px; font-weight: 600;">Task Completed</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 13px;">${formattedDateTime}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${adminName},</p>
                        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
                          Great news! A task has been completed. Here are the details:
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Task Details Box -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ecfdf5; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; border-left: 4px solid #10b981;">
                          <tr>
                            <td style="padding: 24px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td style="padding-bottom: 15px;">
                                    <span style="display: inline-block; background: #10b981; color: white; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">✅ Completed</span>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 120px; font-size: 14px; color: #64748b; font-weight: 500;">Task:</td>
                                        <td style="font-size: 16px; color: #1e293b; font-weight: 600;">${taskTitle}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 120px; font-size: 14px; color: #64748b; font-weight: 500;">Task Type:</td>
                                        <td style="font-size: 14px; color: #1e293b;">${taskTypeLabel}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ${stageName ? `
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 120px; font-size: 14px; color: #64748b; font-weight: 500;">Stage:</td>
                                        <td style="font-size: 14px; color: #1e293b;">${stageName}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ` : ''}
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 120px; font-size: 14px; color: #64748b; font-weight: 500;">Client:</td>
                                        <td style="font-size: 14px; color: #1e293b; font-weight: 500;">${clientName}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 0;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 120px; font-size: 14px; color: #64748b; font-weight: 500;">Completed By:</td>
                                        <td style="font-size: 14px; color: #1e293b;">
                                          <strong>${completedByName}</strong> <span style="color: #6b7280;">(${roleLabel})</span>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                      <td style="text-align: center; padding: 10px 0 0;">
                        <a href="https://legacy.hubonesystems.net/admin" 
                           style="display: inline-block; background-color: #10b981; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; font-size: 15px; font-weight: 600; padding: 14px 36px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                          View Dashboard →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer - Legacy Accounting Services Branding -->
              <tr>
                <td style="background-color: #5a1f2d; padding: 30px 40px; border-radius: 0 0 16px 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 8px; font-size: 14px; color: #d4a574; font-weight: 600;">Legacy Accounting Services</p>
                        <p style="margin: 0 0 15px; font-size: 12px; color: rgba(255,255,255,0.5);">Client Portal - Automated Notification</p>
                        <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.5);">© ${currentYear} Legacy Accounting Services – All Rights Reserved.</p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: adminEmail,
    subject,
    html,
  });
}


interface AdminMessageNotificationOptions {
  adminEmail: string;
  adminName: string;
  senderName: string;
  senderRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  messagePreview: string;
  clientName?: string;
}

/**
 * Send notification to admin when someone sends them a message
 */
export async function sendAdminMessageNotification({
  adminEmail,
  adminName,
  senderName,
  senderRole,
  messagePreview,
  clientName,
}: AdminMessageNotificationOptions) {
  console.log(`📧 sendAdminMessageNotification called for ${adminEmail}`);

  const currentYear = new Date().getFullYear();
  const formattedDateTime = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const roleLabels: Record<string, string> = {
    'CLIENT': 'Client',
    'CPA': 'Preparer',
    'SERVICE_CENTER': 'Service Center',
  };

  const roleLabel = roleLabels[senderRole] || senderRole;

  // Truncate message preview
  const truncatedPreview = messagePreview.length > 200
    ? messagePreview.substring(0, 200) + '...'
    : messagePreview;

  const subject = `💬 New Message from ${senderName} (${roleLabel})`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Message</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header - Legacy Accounting Services Branding -->
              <tr>
                <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; background: linear-gradient(135deg, #5a1f2d 0%, #722f3e 50%, #8b3d4d 100%); padding: 30px 40px 25px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <!-- Company Name - Clean Text Branding -->
                        <div style="margin-bottom: 5px;">
                          <span style="font-size: 22px; color: #d4a574; font-weight: 700; letter-spacing: 2px; font-family: Georgia, 'Times New Roman', serif;">LEGACY</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                          <span style="font-size: 10px; color: rgba(255,255,255,0.85); letter-spacing: 2px;">ACCOUNTING SERVICES</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center;">
                        <h1 style="color: white; margin: 0 0 5px; font-size: 20px; font-weight: 600;">New Message Received</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 12px;">${formattedDateTime}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${adminName},</p>
                        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
                          You have received a new message. Here are the details:
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Message Details Box -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border-left: 4px solid #3b82f6;">
                          <tr>
                            <td style="padding: 24px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td style="padding-bottom: 15px;">
                                    <span style="display: inline-block; background: #3b82f6; color: white; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">💬 Message</span>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">From:</td>
                                        <td style="font-size: 16px; color: #1e293b; font-weight: 600;">${senderName}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Role:</td>
                                        <td style="font-size: 14px; color: #1e293b;">${roleLabel}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ${clientName ? `
                                <tr>
                                  <td style="padding-bottom: 12px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                      <tr>
                                        <td style="width: 100px; font-size: 14px; color: #64748b; font-weight: 500;">Client:</td>
                                        <td style="font-size: 14px; color: #1e293b;">${clientName}</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                                ` : ''}
                                <tr>
                                  <td style="padding-top: 12px; border-top: 1px solid #e2e8f0;">
                                    <p style="margin: 0 0 8px; font-size: 14px; color: #64748b; font-weight: 500;">Message Preview:</p>
                                    <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                                      <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">${truncatedPreview}</p>
                                    </div>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                      <td style="text-align: center; padding: 10px 0 0;">
                        <a href="https://legacy.hubonesystems.net/admin" 
                           style="display: inline-block; background-color: #3b82f6; background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: white; font-size: 15px; font-weight: 600; padding: 14px 36px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                          Reply Now →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer - Legacy Accounting Services Branding -->
              <tr>
                <td style="background-color: #5a1f2d; padding: 30px 40px; border-radius: 0 0 16px 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 8px; font-size: 14px; color: #d4a574; font-weight: 600;">Legacy Accounting Services</p>
                        <p style="margin: 0 0 15px; font-size: 12px; color: rgba(255,255,255,0.5);">Client Portal - Automated Notification</p>
                        <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.5);">© ${currentYear} Legacy Accounting Services – All Rights Reserved.</p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: adminEmail,
    subject,
    html,
  });
}

// ===== REUSABLE EMAIL TEMPLATE WRAPPER =====

interface EmailWrapperOptions {
  recipientName?: string;
  headerTitle?: string;
  headerIcon?: string;
  headerColor?: string;
  bodyContent: string;
  showActionButton?: boolean;
  actionButtonUrl?: string;
  actionButtonLabel?: string;
}

/**
 * Wrap any email content with the professional Legacy ClientHub HTML template
 * This ensures consistent styling with header, footer, and copyright across all emails
 */
export function wrapEmailContent({
  recipientName,
  headerTitle = 'Notification',
  headerIcon = '📧',
  headerColor = '#6366f1',
  bodyContent,
  showActionButton = true,
  actionButtonUrl = 'https://legacy.hubonesystems.net',
  actionButtonLabel = 'View in ClientHub',
}: EmailWrapperOptions): string {
  const currentYear = new Date().getFullYear();
  const formattedDateTime = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Convert plain text or simple HTML to properly formatted HTML with line breaks
  const formattedBody = bodyContent
    .replace(/\n/g, '<br>')
    .replace(/\r/g, '');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${headerTitle}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
              
              <!-- Header - Legacy Accounting Services Branding -->
              <tr>
                <td bgcolor="#5a1f2d" style="background-color: #5a1f2d; background: linear-gradient(135deg, #5a1f2d 0%, #722f3e 50%, #8b3d4d 100%); padding: 30px 40px 25px; border-radius: 16px 16px 0 0; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <!-- Company Name - Clean Text Branding -->
                        <div style="margin-bottom: 5px;">
                          <span style="font-size: 22px; color: #d4a574; font-weight: 700; letter-spacing: 2px; font-family: Georgia, 'Times New Roman', serif;">LEGACY</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                          <span style="font-size: 10px; color: rgba(255,255,255,0.85); letter-spacing: 2px;">ACCOUNTING SERVICES</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align: center;">
                        <h1 style="color: white; margin: 0 0 5px; font-size: 20px; font-weight: 600;">${headerTitle}</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 12px;">${formattedDateTime}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Main Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    ${recipientName ? `
                    <tr>
                      <td>
                        <p style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 500;">Hello ${recipientName},</p>
                      </td>
                    </tr>
                    ` : ''}
                    
                    <!-- Email Body Content -->
                    <tr>
                      <td style="padding: 0 0 25px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border-left: 4px solid ${headerColor};">
                          <tr>
                            <td style="padding: 24px;">
                              <div style="font-size: 15px; color: #374151; line-height: 1.7;">
                                ${formattedBody}
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    ${showActionButton ? `
                    <!-- CTA Button -->
                    <tr>
                      <td style="text-align: center; padding: 10px 0 0;">
                        <a href="${actionButtonUrl}" 
                           style="display: inline-block; background-color: ${headerColor}; background: linear-gradient(135deg, ${headerColor} 0%, #8b5cf6 100%); color: white; font-size: 15px; font-weight: 600; padding: 14px 36px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                          ${actionButtonLabel} →
                        </a>
                      </td>
                    </tr>
                    ` : ''}
                  </table>
                </td>
              </tr>
              
              <!-- Footer - Legacy Accounting Services Branding -->
              <tr>
                <td style="background-color: #5a1f2d; padding: 30px 40px; border-radius: 0 0 16px 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 8px; font-size: 14px; color: #d4a574; font-weight: 600;">Legacy Accounting Services</p>
                        <p style="margin: 0 0 15px; font-size: 12px; color: rgba(255,255,255,0.5);">Client Portal - Automated Notification</p>
                        <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px; margin-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.5);">© ${currentYear} Legacy Accounting Services – All Rights Reserved.</p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Send a custom email using the professional template wrapper
 */
export async function sendCustomEmail({
  to,
  subject,
  recipientName,
  bodyContent,
  headerTitle,
  headerIcon,
  headerColor,
  showActionButton,
  actionButtonUrl,
  actionButtonLabel,
}: {
  to: string;
  subject: string;
  recipientName?: string;
  bodyContent: string;
  headerTitle?: string;
  headerIcon?: string;
  headerColor?: string;
  showActionButton?: boolean;
  actionButtonUrl?: string;
  actionButtonLabel?: string;
}) {
  const html = wrapEmailContent({
    recipientName,
    headerTitle,
    headerIcon,
    headerColor,
    bodyContent,
    showActionButton,
    actionButtonUrl,
    actionButtonLabel,
  });

  return sendEmail({
    to,
    subject,
    html,
  });
}

// ===== ADMIN NOTIFICATION FUNCTIONS =====

interface AdminDocumentNotificationOptions {
  adminEmail: string;
  adminName: string;
  uploaderName: string;
  uploaderRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  documentName: string;
  clientName: string;
  clientId: number | string;
  folderPath?: string;
}

/**
 * Send notification to admin when a document is uploaded
 */
export async function sendAdminDocumentUploadNotification({
  adminEmail,
  adminName,
  uploaderName,
  uploaderRole,
  documentName,
  clientName,
  clientId,
  folderPath,
}: AdminDocumentNotificationOptions) {
  console.log(`📧 sendAdminDocumentUploadNotification called for ${adminEmail}`);

  const roleLabels: Record<string, string> = {
    'CLIENT': 'Client',
    'CPA': 'Preparer',
    'SERVICE_CENTER': 'Service Center',
  };

  const roleLabel = roleLabels[uploaderRole] || uploaderRole;

  const locationInfo = folderPath
    ? `<strong>Folder:</strong> ${folderPath}`
    : '<strong>Location:</strong> Root folder';

  const bodyContent = `
    <p style="margin: 0 0 20px; font-size: 15px; color: #475569; line-height: 1.6;">
      A new document has been uploaded by <strong style="color: #10b981;">${uploaderName}</strong> (${roleLabel}).
    </p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0fdf4; border-radius: 12px; border-left: 4px solid #10b981; margin-bottom: 20px;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 10px; font-size: 14px; color: #166534;"><strong>📄 Document:</strong> ${documentName}</p>
          <p style="margin: 0 0 10px; font-size: 14px; color: #166534;"><strong>👤 Client:</strong> ${clientName}</p>
          <p style="margin: 0; font-size: 14px; color: #166534;">${locationInfo}</p>
        </td>
      </tr>
    </table>
  `;

  return sendCustomEmail({
    to: adminEmail,
    subject: `📄 New Document: "${documentName}" uploaded by ${uploaderName}`,
    recipientName: adminName,
    bodyContent,
    headerTitle: 'Document Uploaded',
    headerIcon: '📄',
    headerColor: '#10b981',
    showActionButton: true,
    actionButtonUrl: `https://legacy.hubonesystems.net/admin/clients/${clientId}`,
    actionButtonLabel: 'View Client Documents',
  });
}

interface AdminFolderNotificationOptions {
  adminEmail: string;
  adminName: string;
  creatorName: string;
  creatorRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  folderName: string;
  clientName: string;
  clientId: number | string;
  parentPath?: string;
}

/**
 * Send notification to admin when a folder is created
 */
export async function sendAdminFolderCreatedNotification({
  adminEmail,
  adminName,
  creatorName,
  creatorRole,
  folderName,
  clientName,
  clientId,
  parentPath,
}: AdminFolderNotificationOptions) {
  console.log(`📧 sendAdminFolderCreatedNotification called for ${adminEmail}`);

  const roleLabels: Record<string, string> = {
    'CLIENT': 'Client',
    'CPA': 'Preparer',
    'SERVICE_CENTER': 'Service Center',
  };

  const roleLabel = roleLabels[creatorRole] || creatorRole;

  const locationInfo = parentPath
    ? `<strong>Parent Folder:</strong> ${parentPath}`
    : '<strong>Location:</strong> Root level';

  const bodyContent = `
    <p style="margin: 0 0 20px; font-size: 15px; color: #475569; line-height: 1.6;">
      A new folder has been created by <strong style="color: #f59e0b;">${creatorName}</strong> (${roleLabel}).
    </p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef3c7; border-radius: 12px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 10px; font-size: 14px; color: #92400e;"><strong>📁 Folder Name:</strong> ${folderName}</p>
          <p style="margin: 0 0 10px; font-size: 14px; color: #92400e;"><strong>👤 Client:</strong> ${clientName}</p>
          <p style="margin: 0; font-size: 14px; color: #92400e;">${locationInfo}</p>
        </td>
      </tr>
    </table>
  `;

  return sendCustomEmail({
    to: adminEmail,
    subject: `📁 New Folder: "${folderName}" created by ${creatorName}`,
    recipientName: adminName,
    bodyContent,
    headerTitle: 'Folder Created',
    headerIcon: '📁',
    headerColor: '#f59e0b',
    showActionButton: true,
    actionButtonUrl: `https://legacy.hubonesystems.net/admin/clients/${clientId}`,
    actionButtonLabel: 'View Client Documents',
  });
}

// ===== BATCH NOTIFICATION FUNCTIONS =====

interface AdminBatchDocumentNotificationOptions {
  adminEmail: string;
  adminName: string;
  uploaderName: string;
  uploaderRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  documents: { name: string; folder?: string }[];
  clientName: string;
  clientId: number | string;
}

/**
 * Send notification to admin when multiple documents are uploaded (batched)
 */
export async function sendAdminBatchDocumentUploadNotification({
  adminEmail,
  adminName,
  uploaderName,
  uploaderRole,
  documents,
  clientName,
  clientId,
}: AdminBatchDocumentNotificationOptions) {
  console.log(`📧 sendAdminBatchDocumentUploadNotification called for ${adminEmail} (${documents.length} documents)`);

  const roleLabels: Record<string, string> = {
    'CLIENT': 'Client',
    'CPA': 'Preparer',
    'SERVICE_CENTER': 'Service Center',
  };

  const roleLabel = roleLabels[uploaderRole] || uploaderRole;
  const docCount = documents.length;
  const docWord = docCount === 1 ? 'document' : 'documents';

  // Build document list HTML
  const documentListHtml = documents.map((doc, index) => {
    const folderInfo = doc.folder ? ` <span style="color: #64748b;">(in ${doc.folder})</span>` : '';
    return `<li style="margin: 0 0 8px; font-size: 14px; color: #166534;">📄 ${doc.name}${folderInfo}</li>`;
  }).join('');

  const bodyContent = `
    <p style="margin: 0 0 15px; font-size: 15px; color: #166534; line-height: 1.6;">
      <strong style="color: #10b981;">${uploaderName}</strong> (${roleLabel}) has uploaded <strong>${docCount} ${docWord}</strong>.
    </p>
    <p style="margin: 0 0 12px; font-size: 14px; color: #166534;"><strong>👤 Client:</strong> ${clientName}</p>
    <p style="margin: 0 0 12px; font-size: 14px; color: #166534; font-weight: 600;">📂 Uploaded Documents:</p>
    <ul style="margin: 0; padding-left: 20px; list-style: none;">
      ${documentListHtml}
    </ul>
  `;

  return sendCustomEmail({
    to: adminEmail,
    subject: `📄 ${docCount} ${docWord} uploaded by ${uploaderName}`,
    recipientName: adminName,
    bodyContent,
    headerTitle: 'Documents Uploaded',
    headerIcon: '📄',
    headerColor: '#10b981',
    showActionButton: true,
    actionButtonUrl: `https://legacy.hubonesystems.net/admin/clients/${clientId}`,
    actionButtonLabel: 'View Client Documents',
  });
}

interface AdminBatchFolderNotificationOptions {
  adminEmail: string;
  adminName: string;
  creatorName: string;
  creatorRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  folders: { name: string; parentPath?: string }[];
  clientName: string;
  clientId: number | string;
}

/**
 * Send notification to admin when multiple folders are created (batched)
 */
export async function sendAdminBatchFolderCreatedNotification({
  adminEmail,
  adminName,
  creatorName,
  creatorRole,
  folders,
  clientName,
  clientId,
}: AdminBatchFolderNotificationOptions) {
  console.log(`📧 sendAdminBatchFolderCreatedNotification called for ${adminEmail} (${folders.length} folders)`);

  const roleLabels: Record<string, string> = {
    'CLIENT': 'Client',
    'CPA': 'Preparer',
    'SERVICE_CENTER': 'Service Center',
  };

  const roleLabel = roleLabels[creatorRole] || creatorRole;
  const folderCount = folders.length;
  const folderWord = folderCount === 1 ? 'folder' : 'folders';

  // Build folder list HTML
  const folderListHtml = folders.map((folder) => {
    const parentInfo = folder.parentPath ? ` <span style="color: #64748b;">(in ${folder.parentPath})</span>` : '';
    return `<li style="margin: 0 0 8px; font-size: 14px; color: #92400e;">📁 ${folder.name}${parentInfo}</li>`;
  }).join('');

  const bodyContent = `
    <p style="margin: 0 0 15px; font-size: 15px; color: #92400e; line-height: 1.6;">
      <strong style="color: #f59e0b;">${creatorName}</strong> (${roleLabel}) has created <strong>${folderCount} ${folderWord}</strong>.
    </p>
    <p style="margin: 0 0 12px; font-size: 14px; color: #92400e;"><strong>👤 Client:</strong> ${clientName}</p>
    <p style="margin: 0 0 12px; font-size: 14px; color: #92400e; font-weight: 600;">📂 Created Folders:</p>
    <ul style="margin: 0; padding-left: 20px; list-style: none;">
      ${folderListHtml}
    </ul>
  `;

  return sendCustomEmail({
    to: adminEmail,
    subject: `📁 ${folderCount} ${folderWord} created by ${creatorName}`,
    recipientName: adminName,
    bodyContent,
    headerTitle: 'Folders Created',
    headerIcon: '📁',
    headerColor: '#f59e0b',
    showActionButton: true,
    actionButtonUrl: `https://legacy.hubonesystems.net/admin/clients/${clientId}`,
    actionButtonLabel: 'View Client Documents',
  });
}

interface AdminTaskCompletedNotificationOptions {
  adminEmail: string;
  adminName: string;
  completedByName: string;
  completedByRole: 'CLIENT' | 'CPA' | 'SERVICE_CENTER';
  taskTitle: string;
  stageName?: string;
  clientName: string;
  clientId: number | string;
}

/**
 * Send notification to admin when a task is completed
 */
export async function sendAdminTaskCompletedNotification({
  adminEmail,
  adminName,
  completedByName,
  completedByRole,
  taskTitle,
  stageName,
  clientName,
  clientId,
}: AdminTaskCompletedNotificationOptions) {
  console.log(`📧 sendAdminTaskCompletedNotification called for ${adminEmail}`);

  const roleLabels: Record<string, string> = {
    'CLIENT': 'Client',
    'CPA': 'Preparer',
    'SERVICE_CENTER': 'Service Center',
  };

  const roleLabel = roleLabels[completedByRole] || completedByRole;

  const stageInfo = stageName
    ? `<p style="margin: 0 0 10px; font-size: 14px; color: #065f46;"><strong>🚀 Stage:</strong> ${stageName}</p>`
    : '';

  const bodyContent = `
    <p style="margin: 0 0 20px; font-size: 15px; color: #475569; line-height: 1.6;">
      A task has been marked as completed by <strong style="color: #059669;">${completedByName}</strong> (${roleLabel}).
    </p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #d1fae5; border-radius: 12px; border-left: 4px solid #059669; margin-bottom: 20px;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 10px; font-size: 14px; color: #065f46;"><strong>✅ Task:</strong> ${taskTitle}</p>
          ${stageInfo}
          <p style="margin: 0; font-size: 14px; color: #065f46;"><strong>👤 Client:</strong> ${clientName}</p>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; font-size: 14px; color: #64748b;">
      You may want to review the completed task and proceed with the next steps.
    </p>
  `;

  return sendCustomEmail({
    to: adminEmail,
    subject: `✅ Task Completed: "${taskTitle}" by ${completedByName}`,
    recipientName: adminName,
    bodyContent,
    headerTitle: 'Task Completed',
    headerIcon: '✅',
    headerColor: '#059669',
    showActionButton: true,
    actionButtonUrl: `https://legacy.hubonesystems.net/admin/clients/${clientId}`,
    actionButtonLabel: 'View Client Details',
  });
}

/**
 * Get admin email from database
 */
export interface ClientBatchDocumentNotificationOptions {
  clientEmail: string;
  clientName: string;
  uploaderName: string;
  documents: { name: string; folder?: string }[];
}

/**
 * Send notification to CLIENT when documents are uploaded by Admin
 */
export async function sendClientBatchDocumentUploadNotification({
  clientEmail,
  clientName,
  uploaderName,
  documents,
}: ClientBatchDocumentNotificationOptions) {
  console.log(`📧 sendClientBatchDocumentUploadNotification called for ${clientEmail} (${documents.length} documents)`);

  const docCount = documents.length;
  const docWord = docCount === 1 ? 'document' : 'documents';

  // Build document list HTML
  const documentListHtml = documents.map((doc) => {
    const folderInfo = doc.folder ? ` <span style="color: #64748b;">(in ${doc.folder})</span>` : '';
    return `<li style="margin: 0 0 8px; font-size: 14px; color: #166534;">📄 ${doc.name}${folderInfo}</li>`;
  }).join('');

  const bodyContent = `
    <p style="margin: 0 0 15px; font-size: 15px; color: #166534; line-height: 1.6;">
      <strong style="color: #10b981;">${uploaderName}</strong> (Admin) has uploaded <strong>${docCount} ${docWord}</strong> to your documents.
    </p>
    <p style="margin: 0 0 12px; font-size: 14px; color: #166534; font-weight: 600;">📂 Uploaded Documents:</p>
    <ul style="margin: 0; padding-left: 20px; list-style: none;">
      ${documentListHtml}
    </ul>
  `;

  return sendCustomEmail({
    to: clientEmail,
    subject: `📄 ${docCount} New ${docWord} Uploaded`,
    recipientName: clientName,
    bodyContent,
    headerTitle: 'New Documents Available',
    headerIcon: '📄',
    headerColor: '#10b981',
    showActionButton: true,
    actionButtonUrl: `https://legacy.hubonesystems.net/client/documents`,
    actionButtonLabel: 'View My Documents',
  });
}

export interface ClientBatchFolderNotificationOptions {
  clientEmail: string;
  clientName: string;
  creatorName: string;
  folders: { name: string; parentPath?: string }[];
}

/**
 * Send notification to CLIENT when folders are created by Admin
 */
export async function sendClientBatchFolderCreatedNotification({
  clientEmail,
  clientName,
  creatorName,
  folders,
}: ClientBatchFolderNotificationOptions) {
  console.log(`📧 sendClientBatchFolderCreatedNotification called for ${clientEmail} (${folders.length} folders)`);

  const folderCount = folders.length;
  const folderWord = folderCount === 1 ? 'folder' : 'folders';

  // Build folder list HTML
  const folderListHtml = folders.map((folder) => {
    const parentInfo = folder.parentPath ? ` <span style="color: #64748b;">(in ${folder.parentPath})</span>` : '';
    return `<li style="margin: 0 0 8px; font-size: 14px; color: #92400e;">📁 ${folder.name}${parentInfo}</li>`;
  }).join('');

  const bodyContent = `
    <p style="margin: 0 0 15px; font-size: 15px; color: #92400e; line-height: 1.6;">
      <strong style="color: #f59e0b;">${creatorName}</strong> (Admin) has created <strong>${folderCount} ${folderWord}</strong> in your documents.
    </p>
    <p style="margin: 0 0 12px; font-size: 14px; color: #92400e; font-weight: 600;">📂 Created Folders:</p>
    <ul style="margin: 0; padding-left: 20px; list-style: none;">
      ${folderListHtml}
    </ul>
  `;

  return sendCustomEmail({
    to: clientEmail,
    subject: `📁 ${folderCount} New ${folderWord} Created`,
    recipientName: clientName,
    bodyContent,
    headerTitle: 'New Folders Created',
    headerIcon: '📁',
    headerColor: '#f59e0b',
    showActionButton: true,
    actionButtonUrl: `https://legacy.hubonesystems.net/client/documents`,
    actionButtonLabel: 'View My Documents',
  });
}

/**
 * Get the primary admin email (first admin with notifications enabled)
 */
export async function getAdminEmail(): Promise<{ email: string; name: string } | null> {
  try {
    const { supabase } = await import("@/lib/db");

    const { data, error } = await supabase
      .from("AdminSettings")
      .select("email, full_name")
      .not("email", "is", null)
      .or("notifications_enabled.eq.true,notifications_enabled.is.null")
      .maybeSingle();

    if (error) throw error;

    if (data) {
      console.log("📧 Found admin email:", data.email);
      return {
        email: data.email,
        name: data.full_name || 'Admin',
      };
    }
    console.warn("⚠️ No admin email found in AdminSettings table");
    return null;
  } catch (error) {
    console.error("❌ Failed to get admin email:", error);
    return null;
  }
}

/**
 * Get ALL admins who have notifications enabled
 * Used for sending notifications to multiple admins
 */
export async function getAdminsWithNotificationsEnabled(): Promise<Array<{ email: string; name: string }>> {
  try {
    const { supabase } = await import("@/lib/db");

    // Return ALL admins — no notifications_enabled filter
    const { data, error } = await supabase
      .from("AdminSettings")
      .select("email, full_name")
      .not("email", "is", null);

    if (error) throw error;

    if (data && data.length > 0) {
      const admins = data.map((admin: any) => ({
        email: admin.email,
        name: admin.full_name || 'Admin',
      }));
      console.log(`📧 Found ${admins.length} admin(s) for notifications:`, admins.map(a => a.email));
      return admins;
    }
    console.warn("⚠️ No admins found in AdminSettings");
    return [];
  } catch (error) {
    console.error("❌ Failed to get admins:", error);
    return [];
  }
}

/**
 * Get client email and name from Clients table
 */
export async function getClientEmail(clientId: number | string): Promise<{ email: string; name: string } | null> {
  try {
    const { supabase } = await import("@/lib/db");

    const { data, error } = await supabase
      .from("Clients")
      .select("primary_contact_email, client_name")
      .eq("client_id", Number(clientId))
      .not("primary_contact_email", "is", null)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      console.log(`📧 Found client email for ID ${clientId}:`, data.primary_contact_email);
      return {
        email: data.primary_contact_email,
        name: data.client_name || 'Client',
      };
    }
    console.warn(`⚠️ No client email found for ID ${clientId}`);
    return null;
  } catch (error) {
    console.error(`❌ Failed to get client email for ID ${clientId}:`, error);
    return null;
  }
}

