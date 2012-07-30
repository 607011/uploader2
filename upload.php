<?php
header("Content-type", "text/json");
$filename = $_GET["filename"];
$id = intval($_GET["id"]);
$startByte = intval($_GET["startByte"]);
$endByte = intval($_GET["endByte"]);
$fp = fopen("../uploaded/$filename", "cb");
$postdata = file_get_contents("php://input");
fseek($fp, $startByte);
fwrite($fp, $postdata);
fclose($fp);
echo json_encode(
  array(
    "filename" => $filename,
    "size" => strlen($postdata),
    "id" => $id,
    "startByte" => $startByte,
    "endByte" => $endByte,
    "status" => "ok"
    )
  );
?>