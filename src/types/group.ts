import { Timestamp } from 'firebase/firestore';

export interface GroupMember {
  uid: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'member';
  color: string;
  joinedAt: Timestamp;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  photoURL: string;
  createdAt: Timestamp;
  createdBy: string;
  members: GroupMember[];
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    timestamp: Timestamp;
  };
}

export interface GroupMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  timestamp: Timestamp;
  groupId: string;
  attachments?: string[];
  reactions?: { [key: string]: string[] };
  quotedMessage?: {
    id: string;
    text: string;
    senderName: string;
  };
  isEdited?: boolean;
  isDeleted?: boolean;
  isStarred?: boolean;
  isPinned?: boolean;
} 