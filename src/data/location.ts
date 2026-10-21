export type Location = {
    name: string;
    isOpen : boolean;
    id : string;
    floor : string;
    roomNum : string;
    description? : string;
    latitude : number;
    longitude : number;
    gender? : "Men" | "Women"; // If gender is left out, the room is Open for everyone
}

export const Locations: Location[] =[

    {name : "Thompson Library", isOpen : true, id : "main-musalla",
         floor : "Ground Floor", roomNum: "057", latitude: 39.999280, longitude: -83.014982}, 

    {name : "18th Ave Library", isOpen : true, id : "18th-musalla-men",
         floor : "Basement", roomNum: "060", gender: "Men", latitude: 40.00167230845607, longitude : -83.01319747068368},

    {name : "18th Ave Library", isOpen : true, id : "18th-musalla-women",
         floor : "Basement", roomNum: "050", gender: "Women", latitude: 40.00167230845607, longitude : -83.01319747068368}
]