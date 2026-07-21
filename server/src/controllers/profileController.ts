import { Request, Response } from 'express';
import { profileService } from '../services/profileService';


export class ProfileController {


  // 프로필 조회
  async getProfile(req: Request, res: Response) {

    try {

      const { userId } = req.query;


      const profile =
        await profileService.getProfile(Number(userId));


      res.status(200).json(profile);


    } catch (error: any) {

      res.status(400).json({
        message: error.message
      });

    }

  }


}


export const profileController = new ProfileController();