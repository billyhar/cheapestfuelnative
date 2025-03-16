import { supabase } from './supabase';

/**
 * Utility function to get an authenticated URL for an avatar from Supabase storage
 * @param avatarPath The path of the avatar in Supabase storage
 * @returns The complete authenticated URL for the avatar
 */
export const getAvatarPublicUrl = async (avatarPath: string | null): Promise<string | null> => {
  if (!avatarPath) return null;
  
  try {
    // If it's already a full URL, just add cache busting
    if (avatarPath.startsWith('http')) {
      // For Supabase storage URLs, ensure they're properly formatted
      if (avatarPath.includes('supabase.co/storage/v1/object')) {
        // Extract the file path from the URL
        const filePathMatch = avatarPath.match(/\/object\/([^?]+)/);
        if (filePathMatch && filePathMatch[1]) {
          const filePath = filePathMatch[1];
          const bucketName = filePath.split('/')[0]; // Usually 'avatars'
          const fileName = filePath.split('/').slice(1).join('/');
          
          // Get a signed URL that expires in 1 hour
          const { data } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(fileName, 3600);
            
          return data?.signedUrl || null;
        }
      }
      
      // If not a Supabase URL or we couldn't parse it, just add cache busting
      return `${avatarPath}?ts=${Date.now()}`;
    }
    
    // If it's just a path (no http), construct the full URL
    // Assuming the path is relative to the avatars bucket
    const { data } = await supabase.storage
      .from('avatars')
      .createSignedUrl(avatarPath, 3600);
      
    return data?.signedUrl || null;
  } catch (error) {
    console.error('Error formatting avatar URL:', error);
    return null;
  }
}; 