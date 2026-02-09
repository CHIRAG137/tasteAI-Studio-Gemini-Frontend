import { AuthLayout } from "@/components/auth/AuthLayout";
import { RegisterForm } from "@/components/auth/RegisterForm";

const Register = () => {
  return (
    <AuthLayout 
      title="Create account" 
      subtitle="Start building production-ready chatbots in minutes"
    >
      <RegisterForm />
    </AuthLayout>
  );
};

export default Register;
