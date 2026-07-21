export const getProfile = async(userId:number)=>{
  const response =
    await API.get('/api/profile',{
      params:{
        userId
      }
    });

  return response.data;
};



export const updateNickname = async(
  userId:number,
  nickname:string
)=>{

  const response =
    await API.put(
      '/api/profile/nickname',
      {
        userId,
        nickname
      }
    );


  return response.data;

};