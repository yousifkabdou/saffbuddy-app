export type Location = {
    name: string;
    isOpen : boolean;
    id : string;
    floor : string;
    roomNum : string;
    gender? : "Men" | "Women"; // If gender is left out, the room is Open for everyone
}

export const Locations: Location[] =[

    {name : "Thompson Library", isOpen : true, id : "main-musalla",
         floor : "Ground Floor", roomNum: "057"}, 

    {name : "18th Ave Library", isOpen : true, id : "18th-musalla-men",
         floor : "Basement", roomNum: "060", gender: "Men"},

    {name : "18th Ave Library", isOpen : true, id : "18th-musalla-women",
         floor : "Basement", roomNum: "050", gender: "Women"}
]