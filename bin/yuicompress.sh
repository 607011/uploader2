#!/bin/sh
PATHTOYUI=`pwd`/bin
echo
echo ==============================================
echo COMPRESSING JAVASCRIPTS
echo ==============================================
cd js/src
for f in *.js
do
  java -jar ${PATHTOYUI}/yuicompressor-2.4.2.jar -v --type js --charset utf-8 -o ../$f $f
done
cd ../..
echo ==============================================
echo COMPRESSING STYLESHEETS
echo ==============================================
cd css/src
for f in *.css
do
  java -jar ${PATHTOYUI}/yuicompressor-2.4.2.jar -v --type css --charset utf-8 -o ../$f $f
done
cd ../..
echo READY.