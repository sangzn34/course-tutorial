import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, ShoppingCart, Trash2 } from "lucide-react";
import Link from "next/link";

type ProductCardProps = {
  id: string;
  name: string;
  price: number;
  description: string;
  onAddCart?: () => void;
  onDelete?: () => void;
};

export function ProductCard(props: ProductCardProps) {
  const { id, name, price, description, onAddCart, onDelete } = props;

  return (
    <Card className="relative mx-auto w-full max-w-sm pt-0">
      <div className="absolute inset-0 z-30 aspect-video bg-black/35" />
      <img
        src="https://avatar.vercel.sh/shadcn1"
        alt="Event cover"
        className="relative z-20 aspect-video w-full object-cover brightness-60 grayscale dark:brightness-40"
      />
      <CardHeader>
        <CardAction>
          <Badge variant="secondary">{price?.toFixed(2)} THB</Badge>
        </CardAction>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter className="flex gap-2">
        <Button variant="ghost" onClick={onDelete}>
          <Trash2 />
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          render={<Link href={`/menu/${id}`} />}
        >
          <Eye />
        </Button>
        <Button className="flex-1" onClick={onAddCart}>
          <ShoppingCart /> เพิ่ม
        </Button>
      </CardFooter>
    </Card>
  );
}
