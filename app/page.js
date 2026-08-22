import Store from "../components/Store";
import {createClient} from "../lib/supabase/server";
export default async function Home(){
 const supabase=await createClient();
 const {data}=await supabase.from("products").select("id,name,description,price,image_url,category").eq("active",true).order("created_at",{ascending:false});
 return <><header><a className="brand" href="/">SOUTHSTAR <span>MARKET</span></a><nav><a href="/#products">Shop</a><a href="/login">Admin</a></nav></header><Store products={data||[]}/><footer><b>SOUTHSTAR MARKET</b><span>Secure checkout • Tracked orders</span></footer></>
}