export enum Type {
    FRUIT = "fruit",
    VEGETABLE = "vegetable"
}

export type Produce = {
    id?: number;
    name: string;
    type: Type;
    pricePerKg: number;
};
