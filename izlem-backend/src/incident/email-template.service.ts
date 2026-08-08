import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailTemplateService {
  /**
   * getParentNotificationTemplate
   * Returns the HTML string for the parent notification email.
   */
  getParentNotificationTemplate(
    parent: { firstName: string; lastName: string },
    student: { firstName: string; lastName: string; studentNo: string },
    rule: {
      description: string;
      actionType: string;
      threshold: number;
      category: { name: string };
    },
    actionLabel: string,
  ): string {
    const studentName = `${student.firstName} ${student.lastName}`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>İzlem Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background-color: #0f172a; padding: 24px 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
          <span style="color: #3b82f6;">İ</span>zlem
        </h1>
        <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">School Accountability System</p>
      </td>
    </tr>

    <!-- Alert Banner -->
    <tr>
      <td style="background-color: #3b82f6; padding: 16px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color: #ffffff; font-size: 14px; font-weight: 600;">
              ⚡ ${actionLabel}
            </td>
            <td style="color: #dbeafe; font-size: 13px; text-align: right;">
              ${rule.category.name}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px;">
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Dear <strong>${parent.firstName} ${parent.lastName}</strong>,
        </p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          This is an automated notification from İzlem regarding your child,
          <strong>${studentName}</strong> (Student ID: ${student.studentNo}).
        </p>

        <!-- Info Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 0 0 24px;">
          <tr>
            <td style="padding: 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px;">Category</td>
                  <td style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px; text-align: right;">Occurrences</td>
                </tr>
                <tr>
                  <td style="color: #0f172a; font-size: 16px; font-weight: 600;">${rule.category.name}</td>
                  <td style="color: #dc2626; font-size: 16px; font-weight: 600; text-align: right;">${rule.threshold}</td>
                </tr>
              </table>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 12px 0;" />
              <p style="color: #475569; font-size: 14px; margin: 0;">
                <strong>Action:</strong> ${rule.description}
              </p>
            </td>
          </tr>
        </table>

        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Please contact the school administration if you have any questions or concerns.
        </p>

        <!-- View Full History Button -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
          <tr>
            <td style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/parent"
                 style="display: inline-block; background-color: #3b82f6; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px;">
                📋 View Full History
              </a>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; padding-top: 8px;">
              <span style="color: #94a3b8; font-size: 12px;">Log in to İzlem Portal to view your child's complete record</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #0f172a; padding: 20px 32px; text-align: center;">
        <p style="color: #64748b; font-size: 12px; margin: 0;">
          © 2024 İzlem Systems • Secure Protocol
        </p>
        <p style="color: #475569; font-size: 11px; margin: 4px 0 0;">
          This is an automated message. Do not reply directly.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * getPraiseNotificationTemplate
   */
  getPraiseNotificationTemplate(
    parent: { firstName: string; lastName: string },
    student: { firstName: string; lastName: string; studentNo: string },
    rule: {
      description: string;
      actionType: string;
      threshold: number;
      category: { name: string };
    },
  ): string {
    const studentName = `${student.firstName} ${student.lastName}`;
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>İzlem Achievement</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0fdf4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background-color: #10b981; padding: 24px 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
          🎉 Fantastic News!
        </h1>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px;">
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          Dear <strong>${parent.firstName} ${parent.lastName}</strong>,
        </p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          We are delighted to inform you that your child, <strong>${studentName}</strong>, has achieved a significant milestone!
        </p>

        <!-- Award Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; margin: 0 0 24px;">
          <tr>
            <td style="padding: 24px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🏆</div>
              <h2 style="color: #065f46; margin: 0 0 8px; font-size: 20px;">${rule.category.name} Award</h2>
              <p style="color: #047857; margin: 0; font-size: 16px;">
                ${rule.description}
              </p>
              <div style="margin-top: 16px; display: inline-block; background-color: #10b981; color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                Milestone Reached!
              </div>
            </td>
          </tr>
        </table>

        <!-- CTA -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
          <tr>
            <td style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/parent"
                 style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                🌟 View Achievement Details
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="background-color: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
        © 2024 İzlem Academy • Celebrating Student Success
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * getClassTerminationTemplate
   * Returns HTML string for Class Termination email sent to all parents of the class.
   */
  getClassTerminationTemplate(
    parent: { firstName: string; lastName: string },
    teacher: { firstName: string; lastName: string },
    studentClass: { grade?: string | null; section?: string | null },
    category: { name: string },
  ): string {
    const classLabel = `${studentClass.grade || ''}${studentClass.section ? '-' + studentClass.section : ''}`.trim() || 'Class';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>İzlem Class Termination Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background-color: #991b1b; padding: 24px 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
          🚨 Class Termination Notice
        </h1>
        <p style="color: #fca5a5; margin: 4px 0 0; font-size: 13px;">Grade ${classLabel} • Official Incident Report</p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px;">
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Dear <strong>${parent.firstName} ${parent.lastName}</strong>,
        </p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          This is an urgent notice regarding your child's class (<strong>${classLabel}</strong>).
        </p>

        <!-- Alert Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; margin: 0 0 24px;">
          <tr>
            <td style="padding: 20px;">
              <p style="color: #991b1b; font-size: 16px; font-weight: 700; margin: 0 0 8px;">
                Lesson Terminated by Teacher
              </p>
              <p style="color: #7f1d1d; font-size: 14px; line-height: 1.5; margin: 0;">
                Teacher <strong>${teacher.firstName} ${teacher.lastName}</strong>'s lesson for Grade <strong>${classLabel}</strong> was terminated because of student discipline offenses (<strong>${category.name}</strong>).
              </p>
            </td>
          </tr>
        </table>

        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          As a result of this incident, the lesson has ended early and administrative guidance staff have been dispatched. Please contact the school administration if you require further information.
        </p>

        <!-- CTA Button -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
          <tr>
            <td style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/parent"
                 style="display: inline-block; background-color: #dc2626; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px;">
                📋 View İzlem Portal
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #0f172a; padding: 20px 32px; text-align: center;">
        <p style="color: #64748b; font-size: 12px; margin: 0;">
          © 2024 İzlem Systems • School Accountability
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
