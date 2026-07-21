// client/src/pages/LobbyPage.tsx
import React, { useState, useCallback, useEffect } from 'react';
import '../assets/styles/LobbyStyles.css';
import { RoomList } from '../components/Game/RoomList';
import { BottomNav } from '../components/Game/BottomNav';
import CreateRoomModal from '../components/Game/CreateRoomModal.tsx';
import type { Socket } from 'socket.io-client';
import type { Room } from '../hooks/useSocket';
import ProfileView from '../components/Profile/ProfileView';
import ProfileEditView from '../components/Profile/ProfileEdit';
import { getProfile,updateNickname } from '../api/profileApi';

interface LobbyPageProps {
  socket: Socket | null;
  user: {
    userId: number;
    nickname: string;
    email: string;
  };
  onLogout: () => void;
  onJoinSuccess: (roomInfo: { roomId: string; roomTitle: string }) => void;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({ socket, user, onLogout, onJoinSuccess }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profile, setProfile] = useState({
  nickname: user.nickname,
  profileImage: null,
  totalGames: 0,
  winCount: 0,
  loseCount: 0,
  drawCount: 0,
  rating: 1200,
  winRate: 0,
});
  const requestRoomList = useCallback(() => {
    if (socket?.connected) socket.emit('room:list');
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    socket.on('room:list', (list: Room[]) => setRooms(list));
    // 소켓이 연결되어있으면 바로 리스트 요청
    if (socket.connected) {
        requestRoomList();
    }
    // 소켓이 연결되면 리스트를 불러오도록 이벤트 등록 
    const handleConnect = () => {
        requestRoomList();
    };
    socket.on('connect', handleConnect);

    // 방 입장 이벤트 리스너 
    const handleJoinSuccess = (data: { roomId: string; roomTitle: string }) => {
      setShowCreateModal(false);
      onJoinSuccess(data);
    };

    const handleJoinFail = (data: { message: string }) => {
      alert(`방 입장 실패: ${data.message}`);
    };

    socket.on('room:join:success', handleJoinSuccess);
    socket.on('room:join:fail', handleJoinFail);

    return () => { socket.off('room:list'); 
      socket.off('connect', handleConnect);
      socket.off('room:join:success', handleJoinSuccess);
      socket.off('room:join:fail', handleJoinFail);};
  }, [socket, requestRoomList, onJoinSuccess]);


  //프로필 데이터 가져오는 useEffect
  useEffect(() => {
  const fetchProfile = async () => {
    try {

      const data = await getProfile(user.userId);

      setProfile(data);

    } catch(error) {
      console.error("프로필 조회 실패:", error);
    }
  };

  fetchProfile();

  }, [user.userId]);

  const handleCreateRoom = () => {
    setShowCreateModal(true);
  };

  const handleModalCreate = (title: string) => {
    if (title && socket) socket.emit('room:create', { title });
    //setShowCreateModal(false);
  };

  const handleModalClose = () => setShowCreateModal(false);

  const handleJoinRoom = (roomId: string) => {
    if (socket) socket.emit('room:join', { roomId });
  };
  
    if (showProfileEdit) {
  return (
   <ProfileEditView
  nickname={profile.nickname}

  onBackClick={() =>
    setShowProfileEdit(false)
  }


  onSave={async(newNickname)=>{

  try {

    await updateNickname(
      user.userId,
      newNickname
    );


    setProfile({
      ...profile,
      nickname:newNickname
    });


    setShowProfileEdit(false);


  } catch(error){

    console.error(
      "닉네임 변경 실패",
      error
    );

  }

}}

/>


  );
}

    if (showProfile) {
  return (
    <ProfileView
      profile={profile}
      onEditClick={() => setShowProfileEdit(true)}
      onBackClick={() => setShowProfile(false)}
    />
  );
}

  return (
    <div className="phone">
      <div className="pad flex-col flex-1" style={{ gap: '10px' }}>
        <div className="row between">
          <div className="row" style={{ gap: '12px' }}>
            <div className="avatar" style={{ fontSize: '28px' }}>🦁</div>
            <div className="flex-col" style={{ gap: '2px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-main)' }}>
                {user.nickname}님
              </div>
              {/* TODO: 승리 횟수 등 동적 데이터 연동 필요 */}
              <span className="badge" style={{ fontSize: '13px', padding: '4px 10px' }}>🏆 0</span>
            </div>
          </div>
          <div className="row" style={{ gap: '16px' }}>
            <span onClick={onLogout} style={{ fontSize: '18px', color: 'var(--text-sub)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}>
              로그아웃
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'center', margin: '30px 0 15px' }}>
          <p className="title-sm" style={{ fontSize: '48px', margin: 0, fontWeight: 700 }}>증강오목</p>
          <p className="muted" style={{ fontSize: '13px', letterSpacing: '.1em', margin: '4px 0 0', fontWeight: 600 }}>AUGMENTED OMOK</p>
        </div>

        <button className="btn" style={{ fontSize: '18px', fontWeight: 700, padding: '16px' }} onClick={handleCreateRoom}>
          ＋ 방 만들기
        </button>

        <div className="row between" style={{ margin: '28px 0 12px' }}>
          <p className="section-label" style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#333' }}>
            게임방 목록
          </p>
          <span onClick={requestRoomList} style={{ fontSize: '16px', cursor: 'pointer', color: 'var(--teal-dark)', fontWeight: 900 }}>
            🔄 새로고침
          </span>
        </div>

        <RoomList rooms={rooms} onJoinRoom={handleJoinRoom} />
      </div>
      <BottomNav 
       onProfileClick={() => setShowProfile(true)}
       />
      <CreateRoomModal
        visible={showCreateModal}
        defaultName={`${user.nickname}의 방`}
        onClose={handleModalClose} 
        onCreate={handleModalCreate}
      />
      
    </div>
  );
};