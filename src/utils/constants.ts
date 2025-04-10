export const memberColors = [
  '#FF6B6B', // Kırmızı
  '#4ECDC4', // Turkuaz
  '#45B7D1', // Mavi
  '#96CEB4', // Yeşil
  '#FFEEAD', // Sarı
  '#D4A5A5', // Pembe
  '#9B59B6', // Mor
  '#3498DB', // Açık Mavi
  '#E67E22', // Turuncu
  '#2ECC71', // Koyu Yeşil
  '#F1C40F', // Altın
  '#E74C3C', // Koyu Kırmızı
  '#1ABC9C', // Deniz Yeşili
  '#D35400', // Kiremit
  '#8E44AD', // Koyu Mor
];

export const reactions = [
  '👍', // Beğeni
  '❤️', // Kalp
  '😊', // Gülümseme
  '😮', // Şaşırma
  '😢', // Üzgün
  '🙏', // Rica
  '👏', // Alkış
  '🎉', // Kutlama
];

export const defaultGroupPhoto = '/images/default-group.png';

export const maxGroupMembers = 100;
export const maxGroupNameLength = 50;
export const maxGroupDescriptionLength = 500;

export const messageTypes = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  VOICE: 'voice',
} as const;

export const memberRoles = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

export const groupSettings = {
  MAX_PINNED_MESSAGES: 3,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
}; 