# Phú Thọ Market

Marketplace địa phương cho Phú Thọ, ưu tiên **điện thoại, laptop, PC, linh kiện, màn hình và phụ kiện công nghệ**.

## Công nghệ
Next.js 15 + TypeScript + Tailwind CSS + Supabase Auth/Database/Storage.

## Đã kết nối Supabase
- profiles, categories, locations, listings
- RLS cho tài khoản và tin đăng
- Storage bucket listing-images cho ảnh sản phẩm
- Auth email/password
- Tin đăng trạng thái pending để chuẩn bị quy trình duyệt
- Danh mục công nghệ mở rộng

## Chạy local
1. npm install
2. copy .env.example thành .env.local
3. Điền NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
4. npm run dev

## Các trang
- / — trang chủ
- /dang-nhap — đăng nhập Supabase
- /dang-ky — đăng ký Supabase
- /dang-tin — tạo tin + upload ảnh
- /tim-kiem?q=iphone — tìm kiếm
- /tin/[id] — chi tiết tin

## Giai đoạn tiếp theo
1. Bộ lọc giá/khu vực/tình trạng.
2. Trang danh mục và khu vực hoàn chỉnh.
3. Yêu thích, chat người mua/người bán.
4. Dashboard người bán.
5. Admin duyệt tin, báo cáo tin xấu.
6. SEO, sitemap, analytics và deploy.
