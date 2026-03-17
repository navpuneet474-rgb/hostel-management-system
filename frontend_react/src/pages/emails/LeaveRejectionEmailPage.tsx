import { Card, Typography } from "antd";
import { AppShell } from "../../layouts/AppShell";

export const LeaveRejectionEmailPage = () => (
  <AppShell title="Email Template: Leave Rejection">
    <Card className="portal-card">
      <Typography.Title level={4}>Leave Request Rejected</Typography.Title>
      <Typography.Paragraph>
        Your leave request has been rejected. Please review comments and submit a revised request if needed.
      </Typography.Paragraph>
    </Card>
  </AppShell>
);
