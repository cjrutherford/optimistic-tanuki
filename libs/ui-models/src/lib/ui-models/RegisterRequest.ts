import { RegisterSubmitType } from "./register-types";

export default interface RegisterRequest {
    email: string;
    password: string;
    fn: string;
    ln: string;
    confirm: string;
    bio: string;
}

export const submitTypeToRegisterRequest = (data: RegisterSubmitType): RegisterRequest => {
    return {
        email: data.email,
        password: data.password,
        fn: data.firstName,
        ln: data.lastName,
        confirm: data.confirmation,
        bio: data.bio || '',
    };
};
