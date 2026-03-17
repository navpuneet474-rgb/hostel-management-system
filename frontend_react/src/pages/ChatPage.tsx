import { useEffect, useState } from "react";
import { Avatar, Button, Card, Input, List, Space, Tag, Typography, message } from "antd";
import { RobotOutlined, UserOutlined } from "@ant-design/icons";
import { AppShell } from "../layouts/AppShell";
import { clearChatMessages, getRecentMessages, sendChatMessage } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";

interface ChatItem {
  role: "user" | "assistant";
  text: string;
  at: string;
}

export const ChatPage = () => {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await getRecentMessages();
        const list = response.results || [];
        const transformed = list.flatMap((item: { content?: string; ai_response?: string; created_at?: string }) => [
          { role: "user" as const, text: item.content || "", at: item.created_at || "" },
          { role: "assistant" as const, text: item.ai_response || "", at: item.created_at || "" },
        ]);
        setMessages(transformed.filter((m: ChatItem) => m.text));
      } catch {
        message.warning("Could not load recent chat history.");
      }
    };
    void load();
  }, []);

  const onSend = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text, at: new Date().toISOString() }]);
    setSending(true);
    try {
      const result = await sendChatMessage(text);
      setMessages((prev) => [...prev, { role: "assistant", text: result.ai_response || "No response", at: new Date().toISOString() }]);
    } catch {
      message.error("Message failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell title="AI Hostel Chat">
      <div className="chat-shell">
        <div className="chat-header" style={{ padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Space>
            <Avatar style={{ background: "#22c55e" }} icon={<RobotOutlined />} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>AI Hostel Assistant</div>
              <Typography.Text style={{ color: "rgba(255,255,255,0.86)" }}>Online • Ready to help</Typography.Text>
            </div>
          </Space>
          <Tag color="green">Active</Tag>
        </div>

        <div style={{ minHeight: 420, maxHeight: 560, overflowY: "auto", padding: 18, background: "linear-gradient(180deg, #f8fafc, #ffffff)" }}>
          {messages.length === 0 ? (
            <Card style={{ maxWidth: 420, margin: "20px auto", textAlign: "center", borderRadius: 16 }}>
              <RobotOutlined style={{ fontSize: 30, color: "#2563eb" }} />
              <Typography.Title level={5} style={{ marginTop: 10 }}>Welcome to AI Assistant</Typography.Title>
              <Typography.Text type="secondary">Ask about leave requests, guests, maintenance, and hostel rules.</Typography.Text>
            </Card>
          ) : (
            <List
              dataSource={messages}
              renderItem={(item) => (
                <List.Item style={{ border: "none", justifyContent: item.role === "user" ? "flex-end" : "flex-start", padding: "6px 0" }}>
                  <Space align="start">
                    {item.role === "assistant" && <Avatar size="small" icon={<RobotOutlined />} />}
                    <div className={item.role === "user" ? "msg-user" : "msg-ai"}>
                      <Typography.Text>{item.text}</Typography.Text>
                    </div>
                    {item.role === "user" && <Avatar size="small" icon={<UserOutlined />} />}
                  </Space>
                </List.Item>
              )}
            />
          )}
        </div>

        <div style={{ background: "#fff", borderTop: "1px solid #e2e8f0", padding: 16 }}>
          <Input.TextArea rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your question or request..." />
          <Space style={{ marginTop: 12 }}>
            <Button type="primary" onClick={() => void onSend()} loading={sending}>
              Send
            </Button>
            <Button
              danger
              onClick={async () => {
                try {
                  const userId = user?.id || "DEV001";
                  await clearChatMessages(userId);
                  setMessages([]);
                  message.success("Chat cleared");
                } catch {
                  message.error("Unable to clear chat");
                }
              }}
            >
              Clear Chat
            </Button>
          </Space>
        </div>
      </div>
    </AppShell>
  );
};
