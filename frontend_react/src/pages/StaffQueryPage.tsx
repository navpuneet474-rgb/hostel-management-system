import { useState } from "react";
import { Button, Card, Input, List, Typography, message } from "antd";
import { AppShell } from "../layouts/AppShell";
import { askStaffQuery } from "../api/endpoints";

interface QueryEntry {
  query: string;
  response: string;
  time: string;
}

export const StaffQueryPage = () => {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<QueryEntry[]>([]);

  const submit = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const result = await askStaffQuery(query);
      setHistory((prev) => [
        {
          query,
          response: result.response || result.error || "No response",
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      setQuery("");
    } catch {
      message.error("Query failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Staff Query Interface">
      <Card>
        <Typography.Paragraph>Ask natural language questions about students, rooms, requests, or summaries.</Typography.Paragraph>
        <Input.TextArea rows={3} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="How many students are absent today?" />
        <Button style={{ marginTop: 12 }} type="primary" loading={loading} onClick={() => void submit()}>
          Ask
        </Button>
      </Card>
      <Card style={{ marginTop: 16 }} title="Results">
        <List
          dataSource={history}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta title={`${item.query} · ${item.time}`} description={item.response} />
            </List.Item>
          )}
        />
      </Card>
    </AppShell>
  );
};
