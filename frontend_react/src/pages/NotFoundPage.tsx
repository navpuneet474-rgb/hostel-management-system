import { Button, Result } from "antd";
import { Link } from "react-router-dom";

export const NotFoundPage = () => (
  <Result
    status="404"
    title="Page not found"
    subTitle="This route is not configured in the React frontend yet."
    extra={<Button type="primary"><Link to="/">Back to Login</Link></Button>}
  />
);
