import { useRouter as useExpoRouter } from 'expo-router';

export const useRouter = () => {
  const router = useExpoRouter();
  return router;
};
