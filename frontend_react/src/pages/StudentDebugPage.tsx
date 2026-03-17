import { useState } from "react";
import { Button, Card, Input, Space, Typography, message } from "antd";
import { AppShell } from "../layouts/AppShell";
import { getStudentDashboardData } from "../api/endpoints";

export const StudentDebugPage = () => {
  const [output, setOutput] = useState("No debug run yet.");
  const [studentId, setStudentId] = useState("DEV001");

  return (
    <AppShell title="Student Debug">
      <Card>
        <Typography.Paragraph>Debug tool similar to legacy studentDebug page for checking API payloads.</Typography.Paragraph>
        <Space>
          <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Student ID" />
          <Button
            type="primary"
            onClick={async () => {
              try {
                const data = await getStudentDashboardData();
                setOutput(JSON.stringify({ studentId, data }, null, 2));
              } catch {
                message.error("Debug fetch failed");
              }
            }}
          >
            Run Debug
          </Button>
        </Space>
        <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{output}</pre>
      </Card>
    </AppShell>
  );
};
