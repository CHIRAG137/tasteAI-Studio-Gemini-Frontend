import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";

const Login = () => {
  return (
    <AuthLayout 
      title="Welcome back" 
      subtitle="Sign in to continue building amazing chatbots"
    >
      <LoginForm />
    </AuthLayout>
  );
};

export default Login;
