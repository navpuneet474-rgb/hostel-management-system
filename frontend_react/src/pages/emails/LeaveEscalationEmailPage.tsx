import { Card, Typography } from "antd";
import { AppShell } from "../../layouts/AppShell";

export const LeaveEscalationEmailPage = () => (
  <AppShell title="Email Template: Leave Escalation">
    <Card className="portal-card">
      <Typography.Title level={4}>Leave Request Escalation</Typography.Title>
      <Typography.Paragraph>
        This request requires elevated review due to policy thresholds. Please review and approve/reject.
      </Typography.Paragraph>
    </Card>
  </AppShell>
);
