import { Card, Typography } from "antd";
import { AppShell } from "../../layouts/AppShell";

export const MaintenanceStatusUpdateEmailPage = () => (
  <AppShell title="Email Template: Maintenance Update">
    <Card className="portal-card">
      <Typography.Title level={4}>Maintenance Request Status Updated</Typography.Title>
      <Typography.Paragraph>
        The status of your maintenance request has changed. Please check latest progress in the dashboard.
      </Typography.Paragraph>
    </Card>
  </AppShell>
);
