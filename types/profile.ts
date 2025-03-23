export interface Profile {
  id: string;
  handle: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  is_handle_auto_generated?: boolean;
} 