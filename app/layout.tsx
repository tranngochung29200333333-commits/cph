import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"Phú Thọ Market | Mua bán tại Phú Thọ",description:"Chợ online địa phương tập trung điện thoại, máy tính và các sản phẩm tại Phú Thọ."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}
