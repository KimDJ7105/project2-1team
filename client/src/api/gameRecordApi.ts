const API_URL = import.meta.env.VITE_SERVER_URL;


export async function getGameRecords(userId:number){

  const response = await fetch(
    `${API_URL}/api/game-records?userId=${userId}`
  );

  if(!response.ok){
    throw new Error("전적 조회 실패");
  }

  return response.json();

}



export async function getGameRecordDetail(gameId:number){

  const response = await fetch(
    `${API_URL}/api/game-records/${gameId}`
  );


  if(!response.ok){
    throw new Error("상세 조회 실패");
  }


  return response.json();

}