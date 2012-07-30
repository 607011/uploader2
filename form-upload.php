<?php
header("Content-type", "text/json");
$mappings = array();
$nFiles = count($_FILES["files"]["name"]);
for ($i = 0; $i < $nFiles; ++$i)
  $mappings[$_FILES["files"]["name"][$i]] =
     $_FILES["files"]["tmp_name"][$i];
$result_codes = array();
foreach ($mappings as $filename => $tmp_name) {
  $rc = move_uploaded_file($tmp_name, "../uploaded/$filename");
  array_push($result_codes, $rc);
}
echo json_encode(
  array(
    "mappings" => $mappings,
    "result_codes" => $result_codes
  )
);
?>