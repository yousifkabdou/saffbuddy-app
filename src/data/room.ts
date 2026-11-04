// One row of the rooms table in Supabase (column names match the database)
export type Room = {
    id : string;
    building : string;
    is_open : boolean;
    floor : string;
    room_num : string;
    latitude : number;
    longitude : number;
    gender : "Men" | "Women" | null; // null = shared room, open to everyone
}
