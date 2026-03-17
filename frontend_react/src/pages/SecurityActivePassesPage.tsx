import { useEffect, useState } from "react";
import { Card, Table, Tag, message } from "antd";
import { AppShell } from "../layouts/AppShell";
import { getSecurityActivePasses } from "../api/endpoints";

export const SecurityActivePassesPage = () => {
  const [passes, setPasses] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await getSecurityActivePasses();
        setPasses(result.active_passes || []);
      } catch {
        message.error("Unable to load active passes");
      }
    };
    void load();
  }, []);

  return (
    <AppShell title="Security Active Passes">
      <Card>
        <Table
          dataSource={passes}
          rowKey={(r) => String(r.pass_number || Math.random())}
          columns={[
            { title: "Pass", dataIndex: "pass_number" },
            { title: "Student", dataIndex: "student_name" },
            { title: "Student ID", dataIndex: "student_id" },
            { title: "Room", dataIndex: "room_number" },
            { title: "From", dataIndex: "from_date" },
            { title: "To", dataIndex: "to_date" },
            { title: "Days Remaining", dataIndex: "days_remaining" },
            { title: "Approval", dataIndex: "approval_type", render: (v) => <Tag>{String(v || "-")}</Tag> },
          ]}
        />
      </Card>
    </AppShell>
  );
};
